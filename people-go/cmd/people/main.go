package main

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
)

func main() {
	outDir := "../src/data"
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		log.Fatalf("create data dir: %v", err)
	}

	// Stub: write an empty changelog until the real sync logic is wired.
	outPath := filepath.Join(outDir, "changelog.json")
	data, _ := json.MarshalIndent([]any{}, "", "  ")
	if err := os.WriteFile(outPath, data, 0o644); err != nil {
		log.Fatalf("write changelog.json: %v", err)
	}
	log.Printf("wrote %s", outPath)
}
