const components = [];

export function registerComponent(component) {
  components.push(component);
}

export function renderComponents(container) {

  components.forEach(c => {

    const element = document.createElement("div");

    element.className = "plugin-component";

    if (c.render) {
      element.appendChild(c.render());
    }

    container.appendChild(element);

  });

}