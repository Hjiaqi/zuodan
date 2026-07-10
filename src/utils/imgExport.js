import { findIndex as _findIndex, chunk as _chunk, map as _map, cloneDeep as _cloneDeep } from 'lodash'
import { getItem_size, getSize } from './base'
import { imgTable, imgEmptyLeftTable } from './format'
import { SIZES } from './enum'

//图片汇总部分
export const startSetImgExcelData = (arr) => {
    const imgDatas = filterLmgData(arr)//图片排序好的图片
    //   console.log(imgDatas,'----iimgDatas')
    const tableFormatDatas = setTableFormat(imgDatas)//处理规格字符串
    //   console.log(tableFormatDatas,222222)

    const imgExportData = setExportTabel(tableFormatDatas)//图片导出数据
    //   console.log(imgExportData,1111111)
    return imgExportData
}



//-------图片table-------
const setExportTabel = (arr) => {
    const chunkArrs = _chunk(arr, 4)
    const res = []
    chunkArrs.map(arr0 => {
        let obj = {}
        arr0.map((item, j) => {
            obj[`picture-picture-picture${j}`] = imgTable(item)//一定要j,excel的列唯一
            obj[`empty${j}-`] = imgEmptyLeftTable
        })
        res.push(obj)
    })
    return res
}

//-------图片规格统计-------


const setTableFormat = (arr) => {
    //排序，码数从小到大
    const res = arr.map((pItem) => {
        const { specNum } = pItem
        const specNums = _cloneDeep(specNum)

        //规格查每一项
        let dataSpec = []
        SIZES.map((s0, i) => {
            specNums.map((item, ss) => {
                const size = getSize(item.size)
                if (size === s0) {
                    dataSpec.push(item)
                    specNums.splice(ss, 1)
                }
            })
        })
        dataSpec = dataSpec.concat(specNums)
        pItem._specNum = dataSpec
        return pItem
    })
    console.log(res, '---排序后')

    return res.map(item => {
        const specStr = _map(item._specNum, 'size_num_str').join('/')
        return {
            ...item,
            specStr
        }
    })
}

//------------图片数据过滤------------
const filterLmgData = (arr) => {
    const imgOriginalArr = []//图片源数据
    arr.map(item => {
        const href = item.imgId
        //step1: 先找这个图片在不在
        const i = _findIndex(imgOriginalArr, ['imgId', href])
        //step2: 尺寸
        const size = item.sizeAndNum

        //step1：不存在，新加进去
        if (i === -1) {
            const sp = setSpecNum(size, 1)
            const obj = {
                imgId: href,
                img: `https://s-cf-br.shopeesz.com/file/${href}_tn`,
                specNum: [sp],
            }
            imgOriginalArr.push(obj)
        } else {
            //step1:如果已经存在了，找size
            setAlreadySize(imgOriginalArr[i], size)
        }
    })

    return imgOriginalArr
}

const setAlreadySize = (obj, size) => {
    const { specNum } = obj
    //找size
    const i = _findIndex(specNum, ['size', size])
    //没找到
    if (i === -1) {
        const sp = setSpecNum(size, 1)

        specNum.push(sp)
    } else {
        const num = specNum[i].num + 1
        specNum[i].num = num
        specNum[i].size_num_str = size + num
    }
}

//规格
const setSpecNum = (size, num) => {
    return {
        size,
        num: 1,
        size_num_str: size + num
    }
}
//------------图片数据过滤 END------------
