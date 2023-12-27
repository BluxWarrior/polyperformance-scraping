const puppeteer = require('puppeteer');
const fs = require('fs');

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getbyoption(page) {
    const productData = await page.evaluate(() => {
        const skuElement = document.querySelector('div[itemprop="sku"]');
        const finalpriceElement = document.querySelector('span[data-price-type="finalPrice"]');
        const oldpriceElement = document.querySelector('span[data-price-type="oldPrice"]');
        const descriptionElement = document.querySelector('.product.attribute.description');
        // let imageDivs = document.querySelectorAll('div[class="fotorama__thumb fotorama_vertical_ratio fotorama__loaded fotorama__loaded--img"]');
        // // console.log(imageDivs)
        // if (imageDivs.length === 0) {
        const imageDivs = document.querySelectorAll('div[class*="fotorama__stage__frame"]')
        // }


        let skuNumber = skuElement ? skuElement.textContent : '';
        let finalprice = finalpriceElement ? finalpriceElement.textContent.replace('$', '') : '';
        let oldprice = oldpriceElement ? oldpriceElement.textContent.replace('$', '') : '';
        // let description = descriptionElement ? descriptionElement.innerHTML.trim() : '';
        let images = [];

        imageDivs.forEach(div => {
            let img = div.querySelector('img');
            if (img && img.src) {
                images.push(img.src);
            }
        });

        return { 'skuNumber': skuNumber, 'finalprice': finalprice, 'oldprice': oldprice, 'images': images };
    });
    return productData
}


(async () => {
    const browserURL = 'http://127.0.0.1:9222';

    const browser = await puppeteer.connect({ browserURL });
    const page = (await browser.pages())[0];


    await page.goto('https://www.polyperformance.com/apex-designs-power-steering-boost-kit-jeep-jl-jlu-jt');
    await sleep(3000);
    
    const optionname = 'APX-X02-04-001';

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
    // Selector for the div you are interested in
    let selector = 'div[class="fotorama__thumb__arr fotorama__thumb__arr--right"]';

    // Check if the element exists
    let element = await page.$(selector);
    while (element) {
        // If the element exists, click it
        await page.click(selector);
        console.log('Element found and clicked.');

        await sleep(1000);
        element = await page.$(selector);

    };


    const images = await page.evaluate(() => {
        let imageDivs = document.querySelectorAll('div[class="fotorama__thumb fotorama_vertical_ratio fotorama__loaded fotorama__loaded--img"]')

        let images = [];

        imageDivs.forEach(div => {
            let img = div.querySelector('img');
            if (img && img.src) {
                images.push(img.src);
            }
        });

        return images
    });

    console.log(images);

})();