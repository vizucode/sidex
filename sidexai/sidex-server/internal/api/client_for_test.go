package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sidex-ai/sidex-server/internal/ai"
	"github.com/sidex-ai/sidex-server/internal/cost"
)

func TestReachableModelsDoesNotExposeStaticOpenRouterCatalogWithoutConfiguredProviders(t *testing.T) {
	for _, key := range []string{
		"SIDEX_PROVIDER_ANTHROPIC_KEY", "SIDEX_PROVIDER_ANTHROPIC_BASE_URL",
		"SIDEX_PROVIDER_OPENAI_KEY", "SIDEX_PROVIDER_OPENAI_BASE_URL",
		"SIDEX_PROVIDER_OPENAI-COMPATIBLE_KEY", "SIDEX_PROVIDER_OPENAI-COMPATIBLE_BASE_URL",
		"OPENROUTER_API_KEY", "OPENROUTER_BASE_URL",
	} {
		t.Setenv(key, "")
	}

	models := reachableModels()
	if len(models) != 0 {
		t.Fatalf("reachableModels returned %d static models without configured providers", len(models))
	}
	if len(cost.ListModels()) == 0 {
		t.Fatal("test setup expected static fallback catalog entries")
	}
}

func TestClientForUsesOnlyExplicitProviderPrefix(t *testing.T) {
	t.Setenv("SIDEX_PROVIDER_OPENAI-COMPATIBLE_KEY", "custom-test-key")
	h := &Handler{aiClient: ai.NewClient()}

	for _, tt := range []struct {
		name       string
		model      string
		wantCalled bool
		wantModel  string
	}{
		{"custom", "openai-compatible/anthropic/claude-opus-5", true, "anthropic/claude-opus-5"},
		{"legacy", "anthropic/claude-opus-5", false, ""},
	} {
		t.Run(tt.name, func(t *testing.T) {
			called := false
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				called = true
				if r.URL.Path != "/v1/chat/completions" || r.Header.Get("Authorization") != "Bearer custom-test-key" {
					t.Errorf("incorrect custom endpoint or authentication")
				}
				var body struct {
					Model string `json:"model"`
				}
				if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
					t.Error(err)
				}
				if body.Model != tt.wantModel {
					t.Errorf("model = %q, want %q", body.Model, tt.wantModel)
				}
				w.Header().Set("Content-Type", "text/event-stream")
				fmt.Fprint(w, "data: [DONE]\n\n")
			}))
			defer server.Close()
			t.Setenv("SIDEX_PROVIDER_OPENAI-COMPATIBLE_BASE_URL", server.URL+"/v1")

			client := h.clientFor(tt.model, "")
			err := client.StreamChat([]ai.Message{{Role: ai.RoleUser, Content: "hello"}}, nil, "", func(ai.StreamChunk) {})
			if tt.wantCalled && err != nil {
				t.Fatal(err)
			}
			if called != tt.wantCalled {
				t.Fatalf("custom endpoint called = %v, want %v", called, tt.wantCalled)
			}
		})
	}
}
