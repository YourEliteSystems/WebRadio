class HtmlRenderer {

    render(item, container) {

        container.innerHTML = "";

        item.render(container);

    }

}

module.exports = new HtmlRenderer();