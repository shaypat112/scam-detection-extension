require("dotenv").config();

const checkUrls = require("../lib/checkUrls");

const message = `Compare this phishing test page:
https://testsafebrowsing.appspot.com/s/phishing.html
with a familiar site such as https://www.google.com/.`;

checkUrls(message)
  .then((result) => console.log(result))
  .catch((error) => {
    console.error("URL reputation test failed:", error.message);
    process.exitCode = 1;
  });
