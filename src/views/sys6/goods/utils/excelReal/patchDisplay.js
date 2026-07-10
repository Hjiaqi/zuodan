import { findIndex as _findIndex } from "lodash";
import { _SPEC_customized_rengong } from "../../../utils/enum.js";
import { _setCnSpecification } from "../../../upload/basicConf.js";

/**
 * 做单导出：补丁/规格列始终尽量显示中文（与上传侧 _setCnPatch 逻辑一致，但不依赖 isPathUseEN）。
 */
export function displayBdAndggCn(str) {
  if (str == null || str === "") return "";
  const s = String(str).trim();
  if (!s) return "";
  if (s === "NO" || s === "No" || s === "no") return "";

  let patchOpts = [];
  try {
    const raw = window.localStorage.getItem("__sys4-base");
    const base = raw ? JSON.parse(raw) : {};
    patchOpts = Array.isArray(base?.patch) ? base.patch : [];
  } catch {
    patchOpts = [];
  }
  const i1 = _findIndex(patchOpts, ["value", s]);
  if (i1 !== -1 && patchOpts[i1].label) return patchOpts[i1].label;

  const i2 = _findIndex(_SPEC_customized_rengong, ["value", s]);
  if (i2 !== -1 && _SPEC_customized_rengong[i2].label) return _SPEC_customized_rengong[i2].label;

  const specCn = _setCnSpecification(s);
  if (specCn !== s) return specCn;

  return s;
}
