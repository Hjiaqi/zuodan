import ExcelJS from "exceljs";
import { simplifyProductName } from "../excelFormat.js";
import { displayBdAndggCn } from "./patchDisplay.js";
import { normalizeImageUrlForFetch } from "./imageUrl.js";
import { buildImageBufferMap } from "./batchFetchImages.js";
import { xlLog } from "./exportLog.js";
import { findIndex as _findIndex } from "lodash";
import { _SPEC_customized_rengong } from "../../../utils/enum.js";
import {
  TEXT_ROW_PT,
  orderSheetImageRowPt,
  applyCardBorder,
  SHEET_FONT_PT,
  SHEET_FONT_NAME,
  imageAnchorInPicColumn,
  imageRowHeightPt,
} from "./sheetLayout.js";

const JIANHAO_IMG = 150;

const WAIBAN_COLS = [
  "序号", "订单号", "下单时间", "球服照片", "服装说明", "码数",
  "定制号码", "定制臂章", "臂章图片", "备注", "收货信息\n【仅姓名】",
  "发货编码", "报货档口", "是否到货", "是否打单", "发货注明",
  "货款", "拿货做货", "印字臂章", "发货", "小计", "国家"
];

// 黄底黑字列
const YELLOW_BG_COLS = new Set([
  "序号", "订单号", "下单时间", "球服照片", "服装说明", "码数",
  "定制号码", "定制臂章", "备注", "收货信息\n【仅姓名】"
]);

// 绿底白字列
const GREEN_BG_COLS = new Set(["发货编码", "是否打单", "国家"]);

// 样式定义
const YELLOW_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
const GREEN_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF008000" } };
const RED_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF0000" } };
const WHITE_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
const WHITE_FONT = { bold: true, color: { argb: "FFFFFFFF" }, name: SHEET_FONT_NAME, size: SHEET_FONT_PT };
const BLACK_FONT = { bold: true, color: { argb: "FF000000" }, name: SHEET_FONT_NAME, size: SHEET_FONT_PT };
const HEADER_FONT_12 = { bold: false, color: { argb: "FF000000" }, name: SHEET_FONT_NAME, size: 12 };
const DATA_FONT = { bold: false, color: { argb: "FF000000" }, name: SHEET_FONT_NAME, size: SHEET_FONT_PT };

function getColFill(colName) {
  if (YELLOW_BG_COLS.has(colName)) return YELLOW_FILL;
  if (GREEN_BG_COLS.has(colName)) return GREEN_FILL;
  return RED_FILL;
}

function getColFont(colName) {
  if (YELLOW_BG_COLS.has(colName)) return BLACK_FONT;
  return WHITE_FONT;
}

/**
 * @param {import('exceljs').Workbook} workbook
 * @param {Array} rows prepareWaibaoSheetRows 返回的数据
 * @param {{ skipImages?: boolean, onProgress?: function, imageFetchConcurrency?: number }} options
 */
export async function buildWaibaoSheet(workbook, rows, options) {
  const skipImages = options?.skipImages === true;
  const onProgress = options?.onProgress;
  const logCtx = options?.logContext || "外包报货";
  xlLog(`${logCtx} buildWaibaoSheet 开始`, { rows: rows.length });
  console.log('[外包报货] buildWaibaoSheet rows[0]:', JSON.stringify(rows[0]));
  console.log('[外包报货] buildWaibaoSheet payTime:', rows[0]?.payTime, 'receiverName:', rows[0]?.receiverName);

  const ws = workbook.addWorksheet("Sheet1", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  // 设置列宽 - 根据内容类型调整
  const colCount = WAIBAN_COLS.length;
  for (let c = 1; c <= colCount; c++) {
    if (c === 2) ws.getColumn(c).width = 30; // 订单号
    else if (c === 3) ws.getColumn(c).width = 25; // 下单时间
    else if (c === 4) ws.getColumn(c).width = 26; // 球服照片
    else if (c === 5) ws.getColumn(c).width = 30; // 服装说明
    else if (c === 8) ws.getColumn(c).width = 22; // 定制臂章
    else if (c === 9) ws.getColumn(c).width = 12; // 臂章图片
    else if (c === 11) ws.getColumn(c).width = 20; // 收货信息【仅姓名】
    else ws.getColumn(c).width = 14;
  }

  // 表头行 - 按列应用不同颜色
  const headerRow = ws.getRow(1);
  headerRow.height = 40;
  WAIBAN_COLS.forEach((colName, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = colName;
    cell.fill = getColFill(colName);
    if (YELLOW_BG_COLS.has(colName)) {
      // 黄底黑字12号不加粗
      cell.font = { bold: false, color: { argb: "FF000000" }, name: SHEET_FONT_NAME, size: 12 };
    } else if (GREEN_BG_COLS.has(colName)) {
      // 绿底白字12号不加粗
      cell.font = { bold: false, color: { argb: "FFFFFFFF" }, name: SHEET_FONT_NAME, size: 12 };
    } else {
      // 红底白字12号不加粗
      cell.font = { bold: false, color: { argb: "FFFFFFFF" }, name: SHEET_FONT_NAME, size: 12 };
    }
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    applyCardBorder(cell);
  });

  // 收集球服图片 URL
  let imageMap = new Map();
  if (!skipImages && rows.length > 0) {
    const imgUrls = rows.map(r => r.imgUrl).filter(Boolean);
    xlLog(`${logCtx} 预拉球服图片`, { count: imgUrls.length });
    imageMap = await buildImageBufferMap(imgUrls, options?.imageFetchConcurrency, {
      onFetchProgress: (done, total) => onProgress?.(done, total),
    });
  }

  // 收集臂章图片 URL
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
  const armPatchImageMap = armPatchUrls.length
    ? await buildImageBufferMap(armPatchUrls, options?.imageFetchConcurrency)
    : new Map();

  // 数据行 - 白底黑字
  const picRowHeight = orderSheetImageRowPt();
  let orderGroupIndex = 0;
  let prevOrderCode = null;
  for (let ri = 0; ri < rows.length; ri++) {
    const rowData = rows[ri];
    const rowIndex = ri + 2; // 1-based, 从第2行开始(第1行是表头)

    const dataRow = ws.getRow(rowIndex);
    dataRow.height = picRowHeight;

    // 序号 - 如果订单号变了则递增
    if (rowData.orderCode !== prevOrderCode) {
      orderGroupIndex++;
      prevOrderCode = rowData.orderCode;
    }
    const seqCell = dataRow.getCell(1);
    seqCell.value = orderGroupIndex;
    seqCell.font = DATA_FONT;
    seqCell.fill = WHITE_FILL;
    seqCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    applyCardBorder(seqCell);

    // 订单号
    const orderCell = dataRow.getCell(2);
    orderCell.value = rowData.orderCode || "";
    orderCell.font = DATA_FONT;
    orderCell.fill = WHITE_FILL;
    orderCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    applyCardBorder(orderCell);

    // 下单时间 - 付款时间
    const dateCell = dataRow.getCell(3);
    dateCell.value = rowData.payTime || "";
    dateCell.font = DATA_FONT;
    dateCell.fill = WHITE_FILL;
    dateCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    applyCardBorder(dateCell);

    // 球服照片 - 图片（嵌入单元格）
    const picCell = dataRow.getCell(4);
    picCell.font = DATA_FONT;
    picCell.fill = WHITE_FILL;
    picCell.alignment = { horizontal: "center", vertical: "middle" };
    applyCardBorder(picCell);

    // 添加球服图片 - 嵌入第4列（球服照片），左右留边距
    if (rowData.imgUrl && !skipImages && imageMap && imageMap.size > 0) {
      const imgKey = normalizeImageUrlForFetch(rowData.imgUrl);
      const img = imgKey ? imageMap.get(imgKey) : null;
      if (img && img.buffer) {
        try {
          const imageId = workbook.addImage({ buffer: img.buffer, extension: img.ext || "png" });
          // 列宽约等于像素：列宽 * 7，左右留边距
          const wCh = ws.getColumn(4).width ?? 26;
          const imgW = wCh * 7 - 10; // 左右各留5像素边距
          const imgH = imgW;
          ws.addImage(imageId, {
            tl: { col: 3.05, row: rowIndex - 1 + 0.06 },
            ext: { width: imgW, height: imgH },
            editAs: "oneCell",
          });
        } catch (imgErr) {
          xlLog(`${logCtx} 球服图片添加失败`, { error: imgErr.message });
        }
      }
    }

    // 服装说明
    const descCell = dataRow.getCell(5);
    descCell.value = rowData.prodName || "";
    descCell.font = DATA_FONT;
    descCell.fill = WHITE_FILL;
    descCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    applyCardBorder(descCell);

    // 码数
    const sizeCell = dataRow.getCell(6);
    sizeCell.value = rowData.size || "";
    sizeCell.font = DATA_FONT;
    sizeCell.fill = WHITE_FILL;
    sizeCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    applyCardBorder(sizeCell);

    // 定制号码 - 使用 displayName（与捡号表一致）
    const nameCell = dataRow.getCell(7);
    nameCell.value = rowData.displayName || "";
    nameCell.font = DATA_FONT;
    nameCell.fill = WHITE_FILL;
    nameCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    applyCardBorder(nameCell);

    // 定制臂章
    const armCell = dataRow.getCell(8);
    armCell.value = rowData.armPatchText || "";
    armCell.font = DATA_FONT;
    armCell.fill = WHITE_FILL;
    armCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    applyCardBorder(armCell);

    // 臂章图片 - 嵌入图片
    const armPicCell = dataRow.getCell(9);
    armPicCell.font = DATA_FONT;
    armPicCell.fill = WHITE_FILL;
    armPicCell.alignment = { horizontal: "center", vertical: "middle" };
    applyCardBorder(armPicCell);

    // 添加臂章图片
    if (rowData.armPatches && !skipImages && armPatchImageMap.size > 0) {
      const armImgs = [];
      for (const p of rowData.armPatches) {
        const idx = _findIndex(_SPEC_customized_rengong, ["value", p]);
        if (idx !== -1 && _SPEC_customized_rengong[idx].url) {
          const key = normalizeImageUrlForFetch(_SPEC_customized_rengong[idx].url);
          const imgBuf = key ? armPatchImageMap.get(key) : null;
          if (imgBuf) armImgs.push(imgBuf);
        }
      }
      if (armImgs.length) {
        const imgH = 50;
        const imgW = 50;
        armImgs.forEach((imgBuf, i) => {
          try {
            const imageId = workbook.addImage({ buffer: imgBuf.buffer, extension: imgBuf.ext || "png" });
            const wCh = ws.getColumn(9).width ?? 15;
            const colPx = Math.max(80, wCh * 7 + 5);
            const xFrac = Math.max(0.04, Math.min(0.42, (colPx - imgW) / 2 / colPx));
            ws.addImage(imageId, {
              tl: { col: 8 + xFrac, row: rowIndex - 1 + 0.05 + i * 0.55 },
              ext: { width: imgW, height: imgH },
              editAs: "oneCell",
            });
          } catch (imgErr) {
            xlLog(`${logCtx} 臂章图片添加失败`, { error: imgErr.message });
          }
        });
      }
    }

    // 备注
    const remarkCell = dataRow.getCell(10);
    remarkCell.value = "";
    remarkCell.font = DATA_FONT;
    remarkCell.fill = WHITE_FILL;
    remarkCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    applyCardBorder(remarkCell);

    // 收货信息【仅姓名】- 收货人姓名
    const receiverCell = dataRow.getCell(11);
    receiverCell.value = rowData.receiverName || "";
    receiverCell.font = DATA_FONT;
    receiverCell.fill = WHITE_FILL;
    receiverCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    applyCardBorder(receiverCell);

    // 剩余列 - 暂时为空
    for (let c = 12; c <= colCount; c++) {
      const cell = dataRow.getCell(c);
      cell.value = "";
      cell.font = DATA_FONT;
      cell.fill = WHITE_FILL;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      applyCardBorder(cell);
    }
  }

  // 合并相同订单号的单元格（第1列序号 + 第2列订单号 + 第12列发货编码）
  let mergeStart = null;
  let mergeOrderCode = null;
  for (let ri = 0; ri < rows.length; ri++) {
    const currentOrderCode = rows[ri].orderCode;
    if (mergeOrderCode === currentOrderCode) {
      // 继续合并
      continue;
    } else {
      // 结束之前的合并
      if (mergeStart !== null && mergeStart < ri) {
        // Excel行号 = ri + 2（第1行是表头）
        ws.mergeCells(mergeStart + 2, 1, ri + 1, 1);  // 序号列合并
        ws.mergeCells(mergeStart + 2, 2, ri + 1, 2);  // 订单号列合并
        ws.mergeCells(mergeStart + 2, 12, ri + 1, 12); // 发货编码列合并
      }
      // 开始新的合并
      mergeStart = ri;
      mergeOrderCode = currentOrderCode;
    }
  }
  // 处理最后一组合并
  if (mergeStart !== null && mergeStart < rows.length) {
    ws.mergeCells(mergeStart + 2, 1, rows.length + 1, 1);  // 序号列合并
    ws.mergeCells(mergeStart + 2, 2, rows.length + 1, 2);  // 订单号列合并
    ws.mergeCells(mergeStart + 2, 12, rows.length + 1, 12); // 发货编码列合并
  }

  xlLog(`${logCtx} buildWaibaoSheet 结束`, { dataRows: rows.length });
  return ws;
}

// 过滤掉不需要显示的臂章值
const DZ_FILTER = ["With name and number", "onlyHasPatch", "Other(Add In The Instruction)"];
function resetAIfInDz(a) {
  if (DZ_FILTER.includes(a)) return "";
  return a;
}

/**
 * 准备外包报货数据
 * @param {Array} jianhaoDataSource 捡号数据源
 */
export function prepareWaibaoSheetRows(jianhaoDataSource) {
  if (!jianhaoDataSource || !jianhaoDataSource.length) return [];

  console.log('[外包报货] jianhaoDataSource 样本:', JSON.stringify(jianhaoDataSource[0]));
  return jianhaoDataSource.map((item) => {
    const armPatches = [item._customPatch, item.worldCupPatch, item.worldCupPatch2].filter(Boolean);
    const armPatchText = armPatches.map(v => displayBdAndggCn(v)).join("\n");

    // 与捡号表相同的姓名和号码逻辑
    let displayName = item._instruction ? item._instruction : item.spec;
    displayName = resetAIfInDz(displayName);

    console.log('[外包报货] item 字段:', Object.keys(item), 'payTime:', item.payTime, 'receiverName:', item.receiverName);

    return {
      orderCode: item.orderCode || "",
      imgUrl: item.imgUrl || "",
      prodName: simplifyProductName(item.productName || ""),
      size: item.size || "",
      displayName: displayName,
      armPatchText: armPatchText,
      armPatches: armPatches, // 保留原始臂章值用于查图片URL
      armPatchImg: item.worldCupPatch || item.worldCupPatch2 || "",
      // 外包报货新增字段
      payTime: item.payTime || item.付款时间 || "",
      receiverName: item.receiverName || item.收货人姓名 || "",
    };
  });
}
