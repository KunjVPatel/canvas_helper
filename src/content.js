// content script: finds a canvas (by index) and serializes it to a data URL, then sends it to background
(function () {
  function findCanvas(index = 0) {
    const canvases = Array.from(document.querySelectorAll("canvas"));
    console.log(`content: found ${canvases.length} canvas elements`);

    if (canvases.length === 0) return null;

    // Filter out invisible or tiny canvases
    const visibleCanvases = canvases.filter((canvas) => {
      const rect = canvas.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(canvas);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        computedStyle.display !== "none" &&
        computedStyle.visibility !== "hidden"
      );
    });

    console.log(
      `content: found ${visibleCanvases.length} visible canvas elements`,
    );

    if (visibleCanvases.length === 0) return canvases[0]; // fallback to first canvas
    return visibleCanvases[index] || visibleCanvases[0];
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== "capture-canvas") return;

    console.log("content: received capture-canvas message", msg);

    (async () => {
      const index = typeof msg.index === "number" ? msg.index : 0;
      const filename = msg.filename || `canvas-${Date.now()}.png`;
      const canvas = findCanvas(index);

      if (!canvas) {
        console.warn("content: no canvas found");
        sendResponse({ success: false, error: "no-canvas-found" });
        return;
      }

      console.log("content: found canvas", canvas.width, "x", canvas.height);

      // Check if canvas has content
      if (canvas.width === 0 || canvas.height === 0) {
        sendResponse({ success: false, error: "canvas-has-no-dimensions" });
        return;
      }

      try {
        // Try modern toBlob API first
        if (canvas.toBlob && typeof canvas.toBlob === "function") {
          console.log("content: using toBlob method");
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                console.error("content: toBlob returned null");
                sendResponse({ success: false, error: "toBlob-failed" });
                return;
              }

              console.log(
                "content: blob created successfully, size:",
                blob.size,
              );

              const reader = new FileReader();
              reader.onloadend = () => {
                const dataUrl = reader.result;
                console.log(
                  "content: dataUrl created, length:",
                  dataUrl.length,
                );
                chrome.runtime.sendMessage(
                  { type: "canvas-data", dataUrl, filename },
                  (response) => {
                    console.log("content: background response:", response);
                  },
                );
                sendResponse({ success: true });
              };
              reader.onerror = () => {
                console.error("content: FileReader error");
                sendResponse({ success: false, error: "filereader-error" });
              };
              reader.readAsDataURL(blob);
            },
            "image/png",
            0.9, // Slightly compress to reduce file size
          );
          return true;
        } else {
          // Fallback to toDataURL
          console.log("content: using toDataURL method");
          const dataUrl = canvas.toDataURL("image/png", 0.9);

          if (!dataUrl || dataUrl === "data:,") {
            throw new Error("toDataURL returned empty or invalid data");
          }

          console.log(
            "content: dataUrl created directly, length:",
            dataUrl.length,
          );
          chrome.runtime.sendMessage(
            { type: "canvas-data", dataUrl, filename },
            (response) => {
              console.log("content: background response:", response);
            },
          );
          sendResponse({ success: true });
          return;
        }
      } catch (err) {
        console.error("content: canvas capture error:", err);
        sendResponse({
          success: false,
          error:
            err.name === "SecurityError" ? "security-error" : "capture-error",
          message: err.message,
        });
      }
    })();
    return true;
  });

  // Log when content script loads
  console.log("content: Canvas capture script loaded");
})();
