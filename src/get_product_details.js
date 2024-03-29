const puppeteer = require("puppeteer");
const fs = require("fs");
const { exec } = require("child_process");
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getbyoption(page, optionname) {
  let productData = await page.evaluate(() => {
    const skuDiv = document.querySelector('div[itemprop="sku"]');

    const finalpriceDiv = document.querySelector(
      'span[data-price-type="finalPrice"]'
    );
    const oldpriceDiv = document.querySelector(
      'span[class="old-price sly-old-price no-display"]'
    );

    let skuNumber = skuDiv ? skuDiv.textContent : "";
    let finalprice = finalpriceDiv
      ? finalpriceDiv.textContent.replace("$", "")
      : "";
    let oldprice = "";
    if (oldpriceDiv) {
      console.log("oldprice style...    ", oldpriceDiv.style);
      //   oldprice = oldpriceDiv.style;
      if (oldpriceDiv.style.length === 0)
        oldprice = oldpriceDiv
          .querySelector('span[class="price"]')
          .textContent.replace("$", "");
    }

    return { skuNumber: skuNumber, finalprice: finalprice, oldprice: oldprice };
  });

  // get images

  // Selector for the div you are interested in
  let selector =
    'div[class="fotorama__thumb__arr fotorama__thumb__arr--right"]';

  // Check if the element exists
  let element = await page.$(selector);
  let count = 0;
  while (element && count < 10) {
    // If the element exists, click it
    try {
      await page.click(selector);
    } catch (error) {
      break;
    }
    console.log("Element found and clicked.");

    await sleep(1000);
    element = await page.$(selector);

    count++;
  }

  const images = await page.evaluate(() => {
    let images = [];

    let imageDivs = document.querySelectorAll(
      'div[class="fotorama__thumb fotorama_vertical_ratio fotorama__loaded fotorama__loaded--img"]'
    );
    // // console.log(imageDivs)
    if (imageDivs.length === 0) {
      imageDivs = document.querySelectorAll(
        'div[class*="fotorama__stage__frame"]'
      );
    }
    imageDivs.forEach((div) => {
      let img = div.querySelector("img");
      if (img && img.src) {
        images.push(
          img.src.replace(
            "b80d83323115175ae066fe783e68fece",
            "a9c76a049f832d84d865b7faf9823bd1"
          )
        );
      }
    });

    return images;
  });
  productData["images"] = images;
  productData["optionname"] = optionname;
  return productData;
}

async function get_details(page, metadata, brandname) {
  // Set a maximum duration to wait for the page load
  try {
    await page.goto(metadata["url"], { waitUntil: "networkidle0" });
    console.log("original...   ", metadata["url"]);
  } catch (err) {
    console.log("loading error....    ", metadata["url"]);
  }

  if (page.url().includes("404")) {
    console.log("Product Not founded...    ", metadata["url"]);
    return {
      options: [],
      brand: brandname,
      name: metadata["name"],
      url: metadata["url"],
      description: "404 Not Found",
      parent_url: "parent_url",
    };
  }

  await sleep(3000);

  const optionvalues = await page.evaluate(() => {
    let options = [];
    const divOptions = document.querySelector(".super-attribute-select");
    if (divOptions) {
      const optionElements = divOptions.querySelectorAll("option");
      optionElements.forEach((option, index) => {
        if (index > 0) {
          options.push({
            name: option.textContent.trim(),
            value: option.value,
          });
        }
      });
      if (options.length === 0)
        throw new Error("Option not found exception: Something went wrong!");
    }
    return options;
  });

  // get details
  const description = await page.evaluate(() => {
    const descriptionElement = document.querySelector(
      ".product.attribute.description"
    );
    let description = descriptionElement.innerHTML.trim();
    return description;
  });

  // get tree using regex pattern
  const html = await page.content();
  const pattern = /window\.google_tag_params\.ecomm_category\s*=\s*'([^']+)'/i;
  const match = pattern.exec(html);
  const tree = match[1];

  // get tree
  // const tree = await page.evaluate(() => {
  //   return document
  //     .querySelector('button[title="Add to Cart"]')
  //     .getAttribute("data-category");
  // });

  // get details by option
  let options = [];
  let count = 0;

  // get original details
  {
    let optionData = await getbyoption(page, "original");
    while (optionData["images"].length === 0) {
      if (count > 5) throw new Error("Forced exception: Images not found!");
      if (count === 5) {
        const img = await page.evaluate(() => {
          return document.querySelector(
            'img[class="gallery-placeholder__image"]'
          ).src;
        });
        optionData["images"].push(img);
        // optionData.push(document.querySelector('img[class="gallery-placeholder__image"]').src
        // images.push(img);)
      } else {
        console.log(metadata["url"]);
        await page.goto(metadata["url"]);
        await sleep(3000);
        optionData = await getbyoption(page, "original");
      }
      count++;
    }
    options.push(optionData);
  }

  // get variant details
  for (const ov of optionvalues) {
    // console.log(optionname);

    await page.select(".super-attribute-select", ov["value"]);
    await sleep(3000);

    let optionData = await getbyoption(page, ov["name"]);
    while (optionData["images"].length === 0) {
      if (count > 5) throw new Error("Forced exception: Images not found!");
      console.log(metadata["url"]);
      await page.goto(metadata["url"]);
      await sleep(3000);
      await page.select(".super-attribute-select", ov["value"]);
      await sleep(3000);
      optionData = await getbyoption(page, ov["name"]);

      count++;
    }
    options.push(optionData);
  }

  // get parent url
  let parent_url = "";
  // const divOptions = await page.evaluate(() => {
  //     const divOptions = document.querySelector('.super-attribute-select');
  //     return divOptions
  // });
  if (optionvalues.length > 0) {
    await page.select(".super-attribute-select", "");
    await sleep(1000);
    parent_url = page.url();
  }

  const product = {
    options: options,
    brand: brandname,
    tree: tree,
    name: metadata["name"],
    url: metadata["url"],
    description: description,
    parent_url: parent_url,
  };

  return product;
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
      await sleep(3000);

      const browserURL = "http://127.0.0.1:9222";

      const browser = await puppeteer.connect({ browserURL });
      const page = (await browser.pages())[0];

      // create directory if data doesn't exist
      if (!fs.existsSync("./assets/data"))
        fs.mkdirSync("./assets/data", { recursive: true });

      const metadata = JSON.parse(
        fs.readFileSync("./assets/metadata.json", "utf8")
      );
      const tree_table = JSON.parse(
        fs.readFileSync("./assets/tree_table.json", "utf8")
      );

      let numberoffiles = fs.readdirSync("./assets/data").length;
      if (numberoffiles === 0) numberoffiles++;

      for (const brand of metadata.slice(numberoffiles - 1)) {
        const brandname = brand["brand name"];

        // load data
        let data = [];
        if (fs.existsSync(`./assets/data/${brandname}.json`))
          data = JSON.parse(
            fs.readFileSync(`./assets/data/${brandname}.json`, "utf8")
          );
        else {
          console.log("New Brand:    ", brandname);
          fs.writeFileSync(`./assets/data/${brandname}.json`, "[]", "utf8");
        }

        for (const mt of brand["products"].slice(data.length)) {
          let product = await get_details(page, mt, brandname);

          if (tree_table[product.name]) {
            console.log("tree exists");
            product.tree = tree_table[product.name].tree.join("/");
          }

          data.push(product);
          const jsonContent = JSON.stringify(data, null, 2);
          fs.writeFileSync(
            `./assets/data/${brandname}.json`,
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

module.exports = get_product_deatils;
