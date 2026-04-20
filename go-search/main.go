package main

import (
"database/sql"
"encoding/json"
"log"
"net/http"
"os"
"strconv"
"strings"
"sync"
"time"
"unicode"

_ "github.com/lib/pq"
)

// ─── Types ────────────────────────────────────────────────────────────────────

type File struct {
ID        int    `json:"id"`
Title     string `json:"title"`
SubName   string `json:"sub_name"`
FileType  string `json:"file_type"`
Downloads int    `json:"downloads"`
FileID    string `json:"file_id"`
}

// ─── Index ────────────────────────────────────────────────────────────────────

type Index struct {
mu      sync.RWMutex
files   []File
norms   []string // pre-normalised title+subname
updated time.Time
}

func normalize(s string) string {
return strings.Map(func(r rune) rune {
if unicode.IsLetter(r) || unicode.IsDigit(r) { return unicode.ToLower(r) }
return ' '
}, s)
}

func (idx *Index) Rebuild(db *sql.DB) error {
rows, err := db.Query(`
SELECT f.id, f.title, COALESCE(s.name,''), f.file_type, f.downloads, f.file_id
FROM   files f
JOIN   categories c ON c.id = f.category_id
JOIN   subjects   s ON s.id = c.subject_id
WHERE  f.is_deleted = 0`)
if err != nil { return err }
defer rows.Close()

var files []File
var norms []string
for rows.Next() {
var f File
if err := rows.Scan(&f.ID, &f.Title, &f.SubName, &f.FileType, &f.Downloads, &f.FileID); err == nil {
files = append(files, f)
norms = append(norms, normalize(f.Title+" "+f.SubName))
}
}
idx.mu.Lock()
idx.files   = files
idx.norms   = norms
idx.updated = time.Now()
idx.mu.Unlock()
log.Printf("✅ Index rebuilt: %d files", len(files))
return nil
}

func (idx *Index) Search(q string, limit int) []File {
idx.mu.RLock()
defer idx.mu.RUnlock()

terms := strings.Fields(normalize(q))
if len(terms) == 0 || len(idx.files) == 0 { return []File{} }

type hit struct{ f File; score int }
hits := make([]hit, 0, 32)

for i, norm := range idx.norms {
s := 0
for _, t := range terms {
if strings.Contains(norm, t) {
s++
if strings.HasPrefix(norm, t) { s++ } // prefix bonus
}
}
if s > 0 { hits = append(hits, hit{idx.files[i], s}) }
}

// Insertion sort — stable, efficient for small result sets
for i := 1; i < len(hits); i++ {
for j := i; j > 0; j-- {
a, b := hits[j-1], hits[j]
worse := a.score < b.score || (a.score == b.score && a.f.Downloads < b.f.Downloads)
if worse { hits[j-1], hits[j] = hits[j], hits[j-1] } else { break }
}
}

out := make([]File, 0, limit)
for i, h := range hits {
if i >= limit { break }
out = append(out, h.f)
}
return out
}

// ─── Globals ──────────────────────────────────────────────────────────────────

var (
globalIdx *Index
globalDB  *sql.DB
)

// ─── Handlers ─────────────────────────────────────────────────────────────────

func handleSearch(w http.ResponseWriter, r *http.Request) {
q := strings.TrimSpace(r.URL.Query().Get("q"))
if q == "" { http.Error(w, `{"error":"missing q"}`, 400); return }
limit := 10
if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l > 0 && l <= 50 { limit = l }

results := globalIdx.Search(q, limit)
w.Header().Set("Content-Type", "application/json")
json.NewEncoder(w).Encode(results)
}

func handleReindex(w http.ResponseWriter, r *http.Request) {
if err := globalIdx.Rebuild(globalDB); err != nil { http.Error(w, err.Error(), 500); return }
w.Write([]byte(`{"ok":true}`))
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
globalIdx.mu.RLock()
count := len(globalIdx.files)
updated := globalIdx.updated
globalIdx.mu.RUnlock()
w.Header().Set("Content-Type", "application/json")
json.NewEncoder(w).Encode(map[string]any{"ok": true, "files": count, "updated": updated})
}

// ─── Main ─────────────────────────────────────────────────────────────────────

func main() {
dbURL := os.Getenv("DATABASE_URL")
if dbURL == "" { log.Fatal("DATABASE_URL required") }

var err error
globalDB, err = sql.Open("postgres", dbURL)
if err != nil { log.Fatal("DB open:", err) }
globalDB.SetMaxOpenConns(5)
globalDB.SetMaxIdleConns(2)
globalDB.SetConnMaxLifetime(time.Hour)
if err := globalDB.Ping(); err != nil { log.Fatal("DB ping:", err) }

globalIdx = &Index{}
if err := globalIdx.Rebuild(globalDB); err != nil { log.Printf("Initial build failed: %v", err) }

// Auto-refresh every 30 s
go func() {
t := time.NewTicker(30 * time.Second)
defer t.Stop()
for range t.C {
if err := globalIdx.Rebuild(globalDB); err != nil { log.Printf("Rebuild error: %v", err) }
}
}()

port := os.Getenv("SEARCH_PORT")
if port == "" { port = "3001" }

mux := http.NewServeMux()
mux.HandleFunc("/search",  handleSearch)
mux.HandleFunc("/reindex", handleReindex)
mux.HandleFunc("/health",  handleHealth)

log.Printf("🔍 Go search service on :%s", port)
if err := http.ListenAndServe(":"+port, mux); err != nil { log.Fatal(err) }
}
