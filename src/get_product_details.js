const puppeteer = require('puppeteer');
const fs = require('fs');
const { exec } = require('child_process');
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getbyoption(page, optionname) {
  let productData = await page.evaluate(() => {
    const skuDiv = document.querySelector('div[itemprop="sku"]');

    const priceDiv = document.querySelector('span[itemprop="offers"]');
    const finalpriceDiv = priceDiv.querySelector('span[data-price-type="finalPrice"]');
    const oldpriceDiv = priceDiv.querySelector('span[data-price-type="oldPrice"]');

    let skuNumber = skuDiv ? skuDiv.textContent : '';
    let finalprice = finalpriceDiv ? finalpriceDiv.textContent.replace('$', '') : '';
    let oldprice = oldpriceDiv ? oldpriceDiv.textContent.replace('$', '') : '';
    // let description = descriptionElement ? descriptionElement.innerHTML.trim() : '';

    return { 'skuNumber': skuNumber, 'finalprice': finalprice, 'oldprice': oldprice };
  });

  // get images

  // Selector for the div you are interested in
  let selector = 'div[class="fotorama__thumb__arr fotorama__thumb__arr--right"]';

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
    console.log('Element found and clicked.');

    await sleep(1000);
    element = await page.$(selector);

    count++;
  };

  const images = await page.evaluate(() => {
    let images = [];

    let imageDivs = document.querySelectorAll('div[class="fotorama__thumb fotorama_vertical_ratio fotorama__loaded fotorama__loaded--img"]');
    // // console.log(imageDivs)
    if (imageDivs.length === 0) {
      imageDivs = document.querySelectorAll('div[class*="fotorama__stage__frame"]');
    }
    imageDivs.forEach(div => {
      let img = div.querySelector('img');
      if (img && img.src) {
        images.push(img.src.replace('b80d83323115175ae066fe783e68fece', 'a9c76a049f832d84d865b7faf9823bd1'));
      }
    });

    return images
  });
  productData['images'] = images;
  productData['optionname'] = optionname;
  return productData
}

async function get_details(page, metadata, brandname) {
  await page.goto(metadata['url'], { timeout: 60000 });
  await sleep(3000);


  const optionvalues = await page.evaluate(() => {
    let options = [];
    const divOptions = document.querySelector('.super-attribute-select');
    if (divOptions) {
      const optionElements = divOptions.querySelectorAll('option');
      optionElements.forEach((option, index) => {
        if (index > 0) {
          options.push({ 'name': option.textContent.trim(), 'value': option.value });
        }
      });
    }
    return options
  });

  const description = await page.evaluate(() => {
    const descriptionElement = document.querySelector('.product.attribute.description');
    let description = descriptionElement.innerHTML.trim();
    return description;
  });


  // get details by option
  let options = [];
  let count = 0;

  // get original details
  {
    let optionData = await getbyoption(page, 'original');
    while (optionData['images'].length === 0) {
      if (count > 5) throw new Error('Forced exception: Something went wrong!');
      console.log(metadata['url']);
      await page.goto(metadata['url']);
      await sleep(3000);
      optionData = await getbyoption(page, 'original');
      count++;
    }
    options.push(optionData);
  }

  // get variant details
  for (const ov of optionvalues) {
    // console.log(optionname);

    await page.select('.super-attribute-select', ov['value']);
    await sleep(3000);

    let optionData = await getbyoption(page, ov['name']);
    while (optionData['images'].length === 0) {
      if (count > 5) throw new Error('Forced exception: Something went wrong!');
      console.log(metadata['url']);
      await page.goto(metadata['url']);
      await sleep(3000);
      await page.select('.super-attribute-select', ov['value']);
      await sleep(3000);
      optionData = await getbyoption(page, ov['name']);

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
    await page.select('.super-attribute-select', "");
    await sleep(1000);
    parent_url = page.url();
  }


  const product = {
    'options': options,
    'brand': brandname,
    'name': metadata['name'],
    'url': metadata['url'],
    'description': description,
    'parent_url': parent_url
  }

  return product
}



async function get_product_deatils() {
  let finished = false
  while (!finished) {
    try {
      await sleep(1000);
      exec('killall chrome');
      await sleep(1000);
      exec('/opt/google/chrome/chrome --profile-directory="Default" --guest --remote-debugging-port=9222');
      await sleep(1000);

      const browserURL = 'http://127.0.0.1:9222';

      const browser = await puppeteer.connect({ browserURL });
      const page = (await browser.pages())[0];

      // create directory if data doesn't exist
      if (!fs.existsSync('./assets/data')) fs.mkdirSync('./assets/data', { recursive: true });

      const metadata = JSON.parse(fs.readFileSync("./assets/metadata.json", "utf8"));

      let numberoffiles = fs.readdirSync("./assets/data").length;
      if (numberoffiles === 0) numberoffiles++;


      for (const brand of metadata.slice(numberoffiles - 1)) {
        const brandname = brand["brand name"];

        // load data
        let data = [];
        if (fs.existsSync(`./assets/data/${brandname}.json`)) data = JSON.parse(fs.readFileSync(`./assets/data/${brandname}.json`, "utf8"));
        else {
          console.log("New Brand:    ", brandname);
          fs.writeFileSync(
            `./assets/data/${brandname}.json`,
            '[]',
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
            `./assets/data/${brandname}.json`,
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

      exec('killall chrome');
      finished = true;
    } catch (error) {
      console.log(error)
    }
  }
}

module.exports = get_product_deatils;