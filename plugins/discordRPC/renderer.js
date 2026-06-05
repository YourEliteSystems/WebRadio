let toast = null;
let timeoutId = null;

window.registerPluginRenderer("discordRPC", {
  init: () => {
    const app = document.getElementById("app") || document.body;
    
    toast = document.createElement("div");
    toast.textContent = "Discord verbunden";
    toast.style.position = "fixed";
    toast.style.bottom = "24px";
    toast.style.right = "24px";
    toast.style.background = "#5865F2";
    toast.style.color = "white";
    toast.style.padding = "10px 16px";
    toast.style.borderRadius = "8px";
    toast.style.fontSize = "14px";
    toast.style.fontWeight = "bold";
    toast.style.boxShadow = "0 4px 14px rgba(0,0,0,0.4)";
    toast.style.zIndex = "10000";
    toast.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    
    app.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    });
    
    timeoutId = setTimeout(() => {
      if (toast) {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        setTimeout(() => {
          if (toast && toast.parentNode) {
            toast.parentNode.removeChild(toast);
            toast = null;
          }
        }, 300);
      }
    }, 3000);
  },
  destroy: () => {
    if (timeoutId) clearTimeout(timeoutId);
    if (toast && toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
    toast = null;
  }
});
