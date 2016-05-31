'use strict';
const fs = require('fs');
const path = require('path');

const _ = require('underscore');
const co = require('co');
const shelljs = require('shelljs');
const thunkify = require('thunkify');
const xml2js = require('xml2js');

const generateSvg = require('../util/generate-svg');

const parseXml = thunkify(xml2js.parseString);
const readFile = thunkify(fs.readFile);
const writeFile = thunkify(fs.writeFile);

module.exports = (source, target/* , options */) => {
  // source here is an svg file
  co(function *() {
      // get font data from `./font.svg`
      const fontPath = path.resolve(source, './font.svg');
      const svgContent = yield readFile(fontPath, 'utf8');
      const parsedSvg = yield parseXml(svgContent);
      const glyphs = parsedSvg.svg.defs[0].font[0].glyph;
      const fontData = {};
      _.each(glyphs, glyph => {
        if (glyph.$.unicode) {
          fontData[glyph.$.unicode.charCodeAt(0)] = glyph.$;
        }
      });
      //console.log(fontData);

      // get font list from `./iconfont.less`
      const lessPath = path.resolve(source, './iconfont.less');
      const lessContent = yield readFile(lessPath, 'utf8');
      const iconList = [];
      const LESS_VAR_REGEXP = /.@\{iconfont-css-prefix\}-([\w-]+):before\s*\{content:"\\([0-9a-f]+)";\}/g;
      _.each(lessContent.split(/\n/), line => {
        if (!line) {
          return;
        }
        const match = LESS_VAR_REGEXP.exec(line);
        if (match) {
          const unicodeHex = match[2];
          const unicodeDec = parseInt(unicodeHex, 16);
          iconList.push(_.extend({
              id: match[1],
              unicodeDec,
              unicodeHex,
            }, fontData[unicodeDec])
          );
        }
      });
      //console.log(iconList);

      // generate separated svg icons
      shelljs.mkdir('-p', target);
      const WIDTH = 1024;
      // cannot yield inside a callback function, so use for... instead of forEach
      for (let i = 0; i < iconList.length; i++) {
        const icon = iconList[i];
        const svgFilePath = path.resolve(target, `./${icon.id}.svg`);
        const advWidth = icon['horiz-adv-x'] || WIDTH;
        const pixelWidth = advWidth > WIDTH ? advWidth / 12 : WIDTH / 12;
        console.log(`[writing...] ${svgFilePath}`);
        yield writeFile(
          svgFilePath,
          generateSvg(_.extend({
            advWidth
          }, icon), null, pixelWidth),
          'utf8'
        );
      }
      console.log('[done separating ant-design icons]');
    }
  );
};