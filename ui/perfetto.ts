import m from "mithril";

function greeter(person) {
    return "Hello, " + person;
}
m('foo');
var user = "Jane User";
document.body.innerHTML = greeter(user);
