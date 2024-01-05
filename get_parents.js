const puppeteer = require('puppeteer');
const fs = require('fs');
const { exec } = require('child_process');
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function get_images(page, url, optionname) {
    if (optionname !== 'original') {
        const value = await page.evaluate((optionname) => {
            const divOptions = document.querySelector('.super-attribute-select');
            if (divOptions) {
                const optionElements = divOptions.querySelectorAll('option');
                for (const option of optionElements) {
                    if (option.textContent.trim() === optionname) {
                        return option.value; // Correctly returns the value from page.evaluate
                    }
                }
            }
        }, optionname);


        await page.select('.super-attribute-select', value);
        await sleep(2000);
    }
    // Selector for the div you are interested in
    let selector = 'div[class="fotorama__thumb__arr fotorama__thumb__arr--right"]';


    // Check if the element exists
    let element = await page.$(selector);
    let count = 0;
    while (element && count < 10) {
        // If the element exists, click it
        await page.click(selector);
        console.log('Element found and clicked.');

        await sleep(1000);
        element = await page.$(selector);

        count++;
    };


    const images = await page.evaluate(() => {
        imageDivs = document.querySelectorAll('div[class="fotorama__thumb fotorama_vertical_ratio fotorama__loaded fotorama__loaded--img"]')

        let images = [];

        imageDivs.forEach(div => {
            let img = div.querySelector('img');
            if (img && img.src) {
                images.push(img.src);
            }
        });

        return images
    });

    return images;
}

async function rehandle(product) {
    let refactored_product = {};


    await sleep(1000);
    exec('killall chrome');
    await sleep(1000);
    exec('/opt/google/chrome/chrome --profile-directory="Default" --guest --remote-debugging-port=9222');
    await sleep(1000);


    const browserURL = 'http://127.0.0.1:9222';
    const browser = await puppeteer.connect({ browserURL });
    page = (await browser.pages())[0];

    await page.goto(product['url']);
    // await page.goto('https://www.polyperformance.com/arb-drawer-fridge-cable-guide');
    await sleep(3000);

    const options = await page.evaluate(() => {
        let options = [];
        const divOptions = document.querySelector('.super-attribute-select');
        if (divOptions) {
            const optionElements = divOptions.querySelectorAll('option');
            optionElements.forEach((option, index) => {
                if (index > 0) {
                    options.push({ 'name': option.textContent.trim(), 'value': option.value });
                    // const value = option.value;
                    // console.log(value);
                    // divOptions.value = value;
                    // divOptions
                }
            });
        }
        return options
    });

    if (options.length > 0) {
        await page.select('.super-attribute-select', "");
        await sleep(2000);

        const new_url = page.url();

        if (product['url'] !== new_url) console.log("new hanle:   ", product['url']);
        product['url'] = new_url;
    }
    const description = await page.evaluate(() => {
        const descriptionElement = document.querySelector('.product.attribute.description');
        let description = descriptionElement ? descriptionElement.innerHTML.trim() : '';

        // let description = descriptionElement.innerHTML.trim();
        if(description === '') throw new Error('Forced exception: Description went wrong!');
        return description;
    });

    product['description'] = description;

    return product;
}


async function run() {
    let original_products = JSON.parse(fs.readFileSync('./products_v3.2.json', 'utf8'));

    let new_products = JSON.parse(fs.readFileSync('./products_v4.0.json', 'utf8'));

    let nonhandle_data = JSON.parse(fs.readFileSync('./nonhandle_data.json', 'utf8'));

    let product = undefined;
    for (const dt of original_products.slice(new_products.length)) {
        console.log(new_products.length);
        product = dt;
        if (nonhandle_data.includes(dt['url'])) {
            console.log(dt['url']);

            product = await rehandle(dt);


        }
        new_products.push(product);

        const jsonContent = JSON.stringify(new_products, null, 2);
        fs.writeFileSync('./products_v4.0.json', jsonContent, 'utf8', (err) => {
            if (err) {
                console.error('An error occurred:', err);
                return;
            }
            console.log('JSON file has been saved.');
        });
    }
}

(async () => {
    while (true) {
        try {
            await run();
        } catch (error) {
            console.log(error);
        };
    }
})();