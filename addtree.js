const puppeteer = require("puppeteer");
const fs = require("fs");
const { exec } = require("child_process");
const { get } = require("https");
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function get_tree(page, metadata) {
  // Set a maximum duration to wait for the page load
  try {
    await page.goto(metadata["url"], { waitUntil: "networkidle0" });
    console.log("original...   ", metadata["url"]);
  } catch (err) {
    console.log("loading error....    ", metadata["url"]);
  }

  if (page.url().includes("404")) {
    console.log("Product Not founded...    ", metadata["url"]);
    return [];
  }

  await sleep(3000);

  // get tree using regex pattern
  const html = await page.content();
  const pattern = /window\.google_tag_params\.ecomm_category\s*=\s*'([^']+)'/i;
  const match = pattern.exec(html);
  const tree = match[1];

  // // get tree
  // const tree = await page.evaluate(() => {
  //   return document
  //     .querySelector('button[title="Add to Cart"]')
  //     .getAttribute("data-category");
  // });

  return tree;
}

async function get_product_deatils() {
  let finished = false;
  while (!finished) {
    try {
      await sleep(1000);
      exec("killall chrome");
      await sleep(1000);
      exec(
        '/opt/google/chrome/chrome --profile-directory="Default" --guest --remote-debugging-port=9222'
      );
      await sleep(1000);

      const browserURL = "http://127.0.0.1:9222";

      const browser = await puppeteer.connect({ browserURL });
      const page = (await browser.pages())[0];

      const metadata = JSON.parse(
        fs.readFileSync("./assets/metadata.json", "utf8")
      );
      const tree_table = JSON.parse(
        fs.readFileSync("./assets/tree_table.json", "utf8")
      );

      let numberoffiles = fs.readdirSync("./assets/add_data").length;
      if (numberoffiles === 0) numberoffiles++;

      for (const brand of metadata.slice(numberoffiles - 1)) {
        const brandname = brand["brand name"];

        // load data
        const data = JSON.parse(
          fs.readFileSync(`./assets/data/${brandname}.json`, "utf8")
        );

        // load add_data
        let add_data = [];
        if (fs.existsSync(`./assets/add_data/${brandname}.json`))
          add_data = JSON.parse(
            fs.readFileSync(`./assets/add_data/${brandname}.json`, "utf8")
          );
        else {
          console.log("New Brand:    ", brandname);
          fs.writeFileSync(`./assets/add_data/${brandname}.json`, "[]", "utf8");
        }

        const len = add_data.length;
        for (const [idx, mt] of brand["products"].slice(len).entries()) {
          const product = data[len + idx];

          // get tree
          let tree = "";
          if (tree_table[product.name]) {
            console.log("tree exists");
            tree = tree_table[product.name].tree.join("/");
          } else tree = product.tree;

          add_data.push({
            options: product.options,
            brand: product.brand,
            tree: tree,
            name: product.name,
            url: product.url,
            description: product.description,
            parent_url: product.parent_url,
          });

          const jsonContent = JSON.stringify(add_data, null, 2);
          fs.writeFileSync(
            `./assets/add_data/${brandname}.json`,
            jsonContent,
            "utf8"
          );
        }
      }

      exec("killall chrome");
      finished = true;
    } catch (error) {
      console.log(error);
    }
  }
}

(async () => {
  await get_product_deatils();
})();

module.exports = get_product_deatils;
