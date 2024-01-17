const puppeteer = require("puppeteer");
const fs = require("fs");
const { exec } = require("child_process");
const { exitCode } = require("process");
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getbyoption(page, optionname) {
  let productData = await page.evaluate(() => {
    const skuDiv = document.querySelector('div[itemprop="sku"]');

    const priceDiv = document.querySelector('span[itemprop="offers"]');

    let finalpriceDiv = undefined;
    let oldpriceDiv = undefined;
    if (priceDiv) {
      finalpriceDiv = priceDiv.querySelector(
        'span[data-price-type="finalPrice"]'
      );
      oldpriceDiv = document.querySelector(
        'span[class="old-price sly-old-price no-display"]'
      );
    }

    let skuNumber = skuDiv ? skuDiv.textContent : "";
    let finalprice = finalpriceDiv
      ? finalpriceDiv.textContent.replace("$", "")
      : "";
    let oldprice = oldpriceDiv
      ? oldpriceDiv
          .querySelector('span[data-price-type="oldPrice"]')
          .textContent.replace("$", "")
      : "";
    // let description = descriptionElement ? descriptionElement.innerHTML.trim() : '';

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

    // if (images.length === 0) {
    //   let img = document.querySelector('img[class="gallery-placeholder__image"]').src
    //   images.push(img);
    // }
    return images;
  });
  productData["images"] = images;
  productData["optionname"] = optionname;
  return productData;
}

async function get_details(page, metadata, brandname) {
  // Set a maximum duration to wait for the page load
  page.goto(metadata["url"]);

  try {
    await page.waitForSelector('div[class="fotorama__caption__wrap"]', {
      visible: true,
    });
    console.log("original...   ", metadata["url"]);
  } catch (error) {
    console.log("Detachment occurred...    ", metadata["url"]);
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

  const description = await page.evaluate(() => {
    const descriptionElement = document.querySelector(
      ".product.attribute.description"
    );
    let description = descriptionElement.innerHTML.trim();
    return description;
  });

  // get details by option
  let options = [];
  let count = 0;

  // get original details
  {
    let optionData = await getbyoption(page, "original");
    while (optionData["images"].length === 0) {
      if (count > 5) throw new Error("Forced exception: Something went wrong!");
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
      if (count > 5) throw new Error("Forced exception: Something went wrong!");
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
    name: metadata["name"],
    url: metadata["url"],
    description: description,
    parent_url: parent_url,
  };

  return product;
}

async function get_product_deatils(numberofprocess = 4) {
  const metadata = JSON.parse(
    fs.readFileSync("./assets/metadata.json", "utf8")
  )["data"];
  const chunksize = Math.ceil(metadata.length / numberofprocess);

  // create directory if data doesn't exist
  if (!fs.existsSync("./assets/data"))
    fs.mkdirSync("./assets/data", { recursive: true });

  // Make a single process
  const singleProcess = async (processnumber) => {
    let finished = false;

    while (!finished) {
      try {
        exec(
          `/opt/google/chrome/chrome --user-data-dir=/tmp/chrome-profile${processnumber} --guest --remote-debugging-port=${
            9222 + processnumber
          }`
        );
        await sleep(1000);

        const browserURL = `http://127.0.0.1:${9222 + processnumber}`;

        const browser = await puppeteer.connect({ browserURL });
        const page = (await browser.pages())[0];

        try {
          // create directory if data doesn't exist
          if (!fs.existsSync(`./assets/data/data${processnumber}`))
            fs.mkdirSync(`./assets/data/data${processnumber}`, {
              recursive: true,
            });

          let numberoffiles = fs.readdirSync(
            `./assets/data/data${processnumber}`
          ).length;
          if (numberoffiles === 0) numberoffiles++;

          for (const brand of metadata.slice(
            chunksize * processnumber + numberoffiles - 1,
            chunksize * (processnumber + 1)
          )) {
            const brandname = brand["brand name"];

            // load data
            let data = [];
            if (
              fs.existsSync(
                `./assets/data/data${processnumber}/${brandname}.json`
              )
            )
              data = JSON.parse(
                fs.readFileSync(
                  `./assets/data/data${processnumber}/${brandname}.json`,
                  "utf8"
                )
              );
            else {
              console.log("New Brand:    ", brandname);
              fs.writeFileSync(
                `./assets/data/data${processnumber}/${brandname}.json`,
                "[]",
                "utf8",
                (err) => {
                  if (err) {
                    console.error("An error occurred:", err);
                    return;
                  }
                  console.log("JSON file has been saved.");
                }
              );
            }

            for (const mt of brand["products"].slice(data.length)) {
              data.push(await get_details(page, mt, brandname));

              const jsonContent = JSON.stringify(data, null, 2);
              fs.writeFileSync(
                `./assets/data/data${processnumber}/${brandname}.json`,
                jsonContent,
                "utf8",
                (err) => {
                  if (err) {
                    console.error("An error occurred:", err);
                    return;
                  }
                  console.log("JSON file has been saved.");
                }
              );
            }
          }

          finished = true;
          browser.close();
        } catch (error) {
          console.log(error);
          browser.close();
        }
      } catch (err) {
        console.log(err);
        exec(
          `ps aux | grep 'chrome' | grep '/tmp/chrome-profile${processnumber}'`,
          (error, stdout, stderr) => {
            if (error) {
              console.error(`exec error: ${error}`);
              return;
            }

            // Process the stdout to find the PID
            const processes = stdout.split("\n");

            // Eliminate the grep process from the results
            const nodeProcesses = processes.filter(
              (line) => !line.includes("grep")
            );

            for (const process of nodeProcesses) {
              // Split the process line into its components
              const parts = process.trim().split(/\s+/);
              // Assuming PID is at position 1 (ps aux typical result)
              const pid = parts[1];
              const command = parts.slice(10).join(" "); // Command starts at position 10 (may vary based on your 'ps' output)

              console.log(`Found process with PID: ${pid} Command: ${command}`);

              exec(`kill -9 ${pid}`);
            }
          }
        );
        await sleep(Math.random() * 10000);
      }
    }
  };

  // Multi- processing
  const processes = [];
  for (
    let processnumber = 0;
    processnumber < numberofprocess;
    processnumber++
  ) {
    processes.push(singleProcess(processnumber)); // Assuming the process numbers start from 0 and increment by 1
  }

  await Promise.all(processes).then(() => {
    const dir = path.join(__dirname, "../assets/data");
    const subdirs = fs.readdirSync(dir);

    for (const sd of subdirs) {
      const fullPath = `${dir}/${sd}`;
      const files = fs.readdirSync(fullPath);

      for (const f of files) {
        fs.renameSync(`${fullPath}/${f}`, `${dir}/${f}`);
      }
      fs.rmdirSync(fullPath);
    }
  });
}

module.exports = get_product_deatils;
