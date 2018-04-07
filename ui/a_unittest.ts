import o = require("ospec");

import { ZipCodeValidator as Validator } from "./a";

o("addition", function() {
    let v = new Validator();
    o(v.isAcceptable('abc')).equals(false);
    o(v.isAcceptable('12345')).equals(true);
});

