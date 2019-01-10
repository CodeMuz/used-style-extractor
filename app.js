const puppeteer = require('puppeteer');
const fs = require('fs');

let urlParts = process.argv[2].split('=');
const url = urlParts[1];

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage()
  
    //Start sending raw DevTools Protocol commands are sent using `client.send()`
    //First off enable the necessary "Domains" for the DevTools commands we care about
    const client = await page.target().createCDPSession()
    await client.send('Page.enable')
    await client.send('DOM.enable')
    await client.send('CSS.enable')
  
    const inlineStylesheetIndex = new Set();
    client.on('CSS.styleSheetAdded', stylesheet => {
      const { header } = stylesheet
      if (header.isInline || header.sourceURL === '' || header.sourceURL.startsWith('blob:')) {
        inlineStylesheetIndex.add(header.styleSheetId);
      }
    });
  
    //Start tracking CSS coverage
    await client.send('CSS.startRuleUsageTracking')
  
    await page.goto(url)
    // const content = await page.content();
    // console.log(content);
  
    const rules = await client.send('CSS.takeCoverageDelta')
    const usedRules = rules.coverage.filter(rule => {
      return rule.used
    })
  
    const slices = [];
    for (const usedRule of usedRules) {
      // console.log(usedRule.styleSheetId)
      if (inlineStylesheetIndex.has(usedRule.styleSheetId)) {
        continue;
      }
  
      const stylesheet = await client.send('CSS.getStyleSheetText', {
        styleSheetId: usedRule.styleSheetId
      });
  
      slices.push(stylesheet.text.slice(usedRule.startOffset, usedRule.endOffset));
    }
  
    fs.writeFile("styles.css", slices.join(''), function(err) {
        if(err) {
            return console.log(err);
        }
    
        console.log("The file was saved!");
    }); 
  
    await page.close();
    await browser.close();
  })();