import ExcelJS from "exceljs";
import { normalizeImageUrlForFetch } from "./imageUrl.js";
import { buildImageBufferMap } from "./batchFetchImages.js";
import {
  applyCardBorder,
  imageRowHeightPt,
  SHEET_FONT_NAME,
  SHEET_FONT_PT,
} from "./sheetLayout.js";
import { displayBdAndggCn } from "./patchDisplay.js";
import { _SPEC_customized_rengong } from "../../../utils/enum.js";
import { findIndex as _findIndex } from "lodash";

const JIANHAO_IMG = 150;
const JIANHAO_COL_COUNT = 10;
/** 捡号表顶行通栏标题（与旧版 HTML 表一致） */
const JIANHAO_TOP_TITLE = "优先捡A号";
/** 姓名和号码、臂章、款式、数量列正文字号（磅） */
const JIANHAO_EMPH_PT = 13;
const HEADER_FILL = { argb: "FFFEFF41" };
const TITLE_ROW_PT = 30;

function toArgb(css) {
  if (css == null || css === "") return undefined;
  const s = String(css).trim();
  if (s === "red") return "FFFF0000";
  if (s === "blue") return "FF0000FF";
  if (s === "green") return "FF008000";
  if (s.startsWith("#") && s.length >= 7) return "FF" + s.slice(1, 7).toUpperCase();
  return undefined;
}

/**
 * @param {import('exceljs').Workbook} workbook
 * @param {Array<{ imgUrl?: string, prodName: string, displayName: string, armPatches: string[], typeLabel: string, number: *, size: *, orderCode: *, textColor?: string }>} rows
 * @param {{ skipImages?: boolean, imageFetchConcurrency?: number, headerDate?: string, onProgress?: (done:number,total:number)=>void }} options
 */
export async function buildJianhaoSheet(workbook, rows, options) {
  const skipImages = options?.skipImages === true;
  const headerDate = options?.headerDate != null ? String(options.headerDate) : "";

  const ws = workbook.addWorksheet("Sheet1", {
    views: [{ state: "frozen", ySplit: 2 }],
  });

  const titles = [
    `衬衫${headerDate}`,
    "款式",
    "姓名和号码",
    "胸章",
    "臂章",
    "臂章图片",
    "款式",
    "数量",
    "码数",
    "订单号",
  ];
  const colWidths = [22, 38, 38, 10, 28, 22, 12, 12, 12, 38];
  colWidths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const top = ws.getRow(1);
  top.height = TITLE_ROW_PT;
  ws.mergeCells(1, 1, 1, JIANHAO_COL_COUNT);
  const topCell = ws.getCell(1, 1);
  topCell.value = JIANHAO_TOP_TITLE;
  topCell.font = { bold: true, name: SHEET_FONT_NAME, size: SHEET_FONT_PT, color: { argb: "FF000000" } };
  topCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  applyCardBorder(topCell);

  const hdr = ws.getRow(2);
  hdr.height = 36;
  titles.forEach((t, i) => {
    const c = i + 1;
    const cell = hdr.getCell(c);
    cell.value = t;
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: HEADER_FILL,
    };
    cell.font = { bold: true, name: SHEET_FONT_NAME, size: SHEET_FONT_PT };
    const centerish = c >= 6 && c <= 8;
    cell.alignment = {
      horizontal: centerish ? "center" : "left",
      vertical: "middle",
      wrapText: true,
    };
    applyCardBorder(cell);
  });

  let imageMap = new Map();
  if (!skipImages && rows.length) {
    const urls = [];
    for (const row of rows) {
      if (row && row.imgUrl) urls.push(row.imgUrl);
    }
    imageMap = await buildImageBufferMap(urls, options?.imageFetchConcurrency, {
      onFetchProgress: options?.onProgress,
    });
  }

  // \u9884\u53d6\u81c2\u7ae0\u56fe\u7247
  const armPatchUrls = [];
  for (const row of rows) {
    if (row.armPatches) {
      for (const p of row.armPatches) {
        const idx = _findIndex(_SPEC_customized_rengong, ["value", p]);
        if (idx !== -1 && _SPEC_customized_rengong[idx].url) {
          armPatchUrls.push(_SPEC_customized_rengong[idx].url);
        }
      }
    }
  }
  const armPatchImageMap = armPatchUrls.length ? await buildImageBufferMap(armPatchUrls, options?.imageFetchConcurrency) : new Map();

  const imgRowPt = imageRowHeightPt(JIANHAO_IMG, 18);
  let r = 3;
  for (const row of rows) {
    ws.getRow(r).height = imgRowPt;
    for (let c = 1; c <= 10; c++) {
      const cell = ws.getCell(r, c);
      applyCardBorder(cell);
      const centerish = c >= 7 && c <= 9;
      cell.alignment = {
        horizontal: centerish ? "center" : "left",
        vertical: "middle",
        wrapText: true,
      };
      cell.font = { name: SHEET_FONT_NAME, size: SHEET_FONT_PT };
    }

    ws.getCell(r, 2).value = row.prodName;

    const nameCell = ws.getCell(r, 3);
    nameCell.value = row.displayName;
    nameCell.font = {
      name: SHEET_FONT_NAME,
      size: JIANHAO_EMPH_PT,
      bold: true,
      color: { argb: "FFFF0000" },
    };

    ws.getCell(r, 4).value = "\u00a0";

    // \u5904\u7406\u81c2\u7ae0\uff1a\u6587\u672c + \u56fe\u7247
    const armCell = ws.getCell(r, 5);
    const armTexts = [];
    const armImgs = [];
    if (row.armPatches) {
      for (const p of row.armPatches) {
        const cn = displayBdAndggCn(p);
        const idx = _findIndex(_SPEC_customized_rengong, ["value", p]);
        const url = idx !== -1 ? _SPEC_customized_rengong[idx].url : null;
        if (cn) armTexts.push(cn);
        if (url) {
          const key = normalizeImageUrlForFetch(url);
          const imgBuf = key ? armPatchImageMap.get(key) : null;
          if (imgBuf) armImgs.push(imgBuf);
        }
      }
    }
    armCell.value = armTexts.join('\n');
    armCell.font = { name: SHEET_FONT_NAME, size: JIANHAO_EMPH_PT, bold: true };

    // \u81c2\u7ae0\u56fe\u7247\u5d4c\u5165\u5230\u7b2c6\u5217\uff08\u5782\u76f4\u5806\u53e0\uff09
    if (armImgs.length) {
      const imgH = 50;
      const imgW = 50;
      armImgs.forEach((imgBuf, i) => {
        const imageId = workbook.addImage({ buffer: imgBuf.buffer, extension: imgBuf.ext });
        ws.addImage(imageId, {
          tl: { col: 5.2, row: r - 1 + 0.05 + i * 0.55 },
          ext: { width: imgW, height: imgH },
          editAs: "oneCell",
        });
      });
    }

    const typeCell = ws.getCell(r, 7);
    typeCell.value = row.typeLabel;
    typeCell.font = { name: SHEET_FONT_NAME, size: JIANHAO_EMPH_PT, bold: true };

    const numCell = ws.getCell(r, 8);
    numCell.value = row.number;
    numCell.font = { name: SHEET_FONT_NAME, size: JIANHAO_EMPH_PT, bold: true };

    ws.getCell(r, 9).value = row.size;

    const oc = ws.getCell(r, 10);
    oc.value = "\u00a0" + String(row.orderCode || "");
    oc.numFmt = "@";
    const ocArgb = toArgb(row.textColor) || "FF000000";
    oc.font = { name: SHEET_FONT_NAME, size: SHEET_FONT_PT, color: { argb: ocArgb } };

    if (!skipImages && row.imgUrl) {
      const key = normalizeImageUrlForFetch(row.imgUrl);
      const img = key ? imageMap.get(key) : null;
      if (img) {
        const imageId = workbook.addImage({
          buffer: img.buffer,
          extension: img.ext,
        });
        const wCh = ws.getColumn(1).width ?? 22;
        const colPx = Math.max(80, wCh * 7 + 5);
        const xFrac = Math.max(
          0.04,
          Math.min(0.42, (colPx - JIANHAO_IMG) / 2 / colPx)
        );
        ws.addImage(imageId, {
          tl: { col: xFrac, row: r - 1 + 0.06 },
          ext: { width: JIANHAO_IMG, height: JIANHAO_IMG },
          editAs: "oneCell",
        });
      }
    }
    r += 1;
  }

  return ws;
}
