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

        count ++;
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

async function refactor(product) {
    const opt_slice = product['options'].length > 1 ? 1 : 0;
    let refactored_product = {};

    let flagwent = false;
    let page = undefined;

    refactored_product['options'] = [];
    for (const option of product['options'].slice(opt_slice)) {

        if (option['images'].length >= 3) {
            if (!flagwent){
                await sleep(1000);
                exec('killall chrome');
                await sleep(1000);
                exec('/opt/google/chrome/chrome --profile-directory="Default" --guest --remote-debugging-port=9222');
                await sleep(1000);
    

                const browserURL = 'http://127.0.0.1:9222';

                const browser = await puppeteer.connect({ browserURL });
                page = (await browser.pages())[0];

                await page.goto(product['url']);
                await sleep(3000);

                flagwent = true;
            }

            let count = 0;
            let images = await get_images(page, product['url'], option["optionname"]);
            while (images.length === 0) {
                if (count > 5) throw new Error('Forced exception: Something went wrong!');
                console.log(product['url']);
                await page.goto(product['url']);
                await sleep(3000);


                images = await get_images(page, product['url'], option["optionname"]);
                count++;
            }
            refactored_product['options'].push({
                "skuNumber": option["skuNumber"],
                "finalprice": option["finalprice"],
                "oldprice": option["oldprice"],
                "images": images,
                "optionname": option["optionname"]
            })
        }
        else refactored_product['options'].push(option);

    }

    refactored_product['brand'] = product['brand'];
    refactored_product['name'] = product['name'];
    refactored_product['url'] = product['url'];
    refactored_product['dscription'] = product['dscription'];

    return refactored_product
}


async function run() {
    let numberoffiles = fs.readdirSync('./refactored_data').length;

    let file_path = `./data/data${numberoffiles - 1}.json`;
    let data = JSON.parse(fs.readFileSync(file_path, 'utf8'));

    let refactored_file_path = `./refactored_data/data${numberoffiles - 1}.json`;
    let refactored_data = JSON.parse(fs.readFileSync(refactored_file_path, 'utf8'));


    while (numberoffiles <= 61) {
        console.log(numberoffiles);
        for (const dt of data.slice(refactored_data.length)) {
            // await sleep(1000);
            // exec('killall chrome');
            // await sleep(1000);
            // exec('/opt/google/chrome/chrome --profile-directory="Default" --guest --remote-debugging-port=9222');
            // await sleep(1000);

            // const browserURL = 'http://127.0.0.1:9222';

            // const browser = await puppeteer.connect({ browserURL });
            // const page = (await browser.pages())[0];


            let product = await refactor(dt);

            refactored_data.push(product);

            const jsonContent = JSON.stringify(refactored_data, null, 2);
            fs.writeFileSync(refactored_file_path, jsonContent, 'utf8', (err) => {
                if (err) {
                    console.error('An error occurred:', err);
                    return;
                }
                console.log('JSON file has been saved.');
            });
        }
        numberoffiles++;
        file_path = `./data/data${numberoffiles - 1}.json`;
        refactored_file_path = `./refactored_data/data${numberoffiles - 1}.json`;

        data = JSON.parse(fs.readFileSync(file_path, 'utf8'));
        refactored_data = [];
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