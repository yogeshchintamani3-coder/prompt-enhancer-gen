console.log("AI Prompt Enhancer Plus: Content Script Loaded");

const BACKEND_URL = "https://prompt-enhancer-backend-vfkc.onrender.com/api/improve-prompt";

// Function to inject button near textareas or contenteditables
function injectImproveButton() {
    // Target common AI input wrappers
    const selectors = [
        "div[contenteditable='true']", // ChatGPT & Claude
        "textarea#prompt-textarea",      // ChatGPT specific
        "textarea"                      // Fallback
    ];

    selectors.forEach(selector => {
        const inputs = document.querySelectorAll(selector);
        inputs.forEach(input => {
            if (input.dataset.enhancerInjected) return;
            input.dataset.enhancerInjected = "true";

            const btn = document.createElement("button");
            btn.className = "prompt-improve-btn";
            btn.innerHTML = "✨ Improve";
            btn.type = "button";

            // Find a good place to insert (usually near the parent or a sibling button)
            const parent = input.parentElement;
            if (parent && !parent.querySelector(".prompt-improve-btn")) {
                // For ChatGPT, the textarea is inside a wrapper. 
                // We'll append it to the wrapper.
                parent.appendChild(btn);
            }

            btn.addEventListener("click", async (e) => {
                e.preventDefault();
                e.stopPropagation();

                const originalText = input.tagName === "TEXTAREA" ? input.value : input.innerText;
                if (!originalText.trim()) return;

                btn.disabled = true;
                btn.classList.add("loading");
                btn.innerText = "Improving...";

                try {
                    const response = await fetch(BACKEND_URL, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ prompt: originalText })
                    });

                    const data = await response.json();
                    if (data.improvedPrompt) {
                        if (input.tagName === "TEXTAREA") {
                            input.value = data.improvedPrompt;
                            // Trigger input event so the site's React/Vue state updates
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                        } else {
                            input.innerText = data.improvedPrompt;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    }
                } catch (err) {
                    console.error("Enhancement failed:", err);
                    alert("Enhancement failed. Check console for details.");
                } finally {
                    btn.disabled = false;
                    btn.classList.remove("loading");
                    btn.innerHTML = "✨ Improve";
                }
            });
        });
    });
}

// Run on load and then observe for dynamic changes (AI sites are very dynamic)
injectImproveButton();
const observer = new MutationObserver(() => {
    injectImproveButton();
});

observer.observe(document.body, { childList: true, subtree: true });
