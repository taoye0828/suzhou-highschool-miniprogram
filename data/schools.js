const { APP_CONFIG } = require('../config/app-config')

const checkedAt = APP_CONFIG.schoolData.sourceCheckedAt

const SOURCES = {
  suzhou2026Admissions: {
    title: '苏州市教育局：关于做好2026年苏州市区各类高级中等学校招生工作的通知',
    url: 'https://www.suzhou.gov.cn/szsrmzf/bmwj/202605/4a9271ac8d7049f8ac0e6f310e79bc57.shtml'
  },
  suzhou2026Autonomous: {
    title: '苏州市教育局：关于做好2026年苏州市区普通高中学校自主招生工作的通知',
    url: 'https://www.suzhou.gov.cn/szsrmzf/bmwj/202605/7b3dd33345cd40eea1894ef727c0bcda.shtml'
  },
  suzhou2026Indicator: {
    title: '苏州市教育局：关于下达2026年苏州市姑苏区、工业园区、高新区普通高中指标生计划的通知',
    url: 'https://www.suzhou.gov.cn/szsrmzf/bmwj/202606/47a0ac6e7af64325bb05b3be28a8b210.shtml'
  },
  changshuList2024: {
    title: '常熟市普通高中名录（数据截至2024年8月）',
    url: 'https://www.suzhou.gov.cn/szsrmzf/zxxjy/202409/eb5864363ba14c48855813d4fb8f0078.shtml'
  }
}

function sourceFields(source, note, sourceType = '政府公开页面') {
  return {
    sourceType,
    sourceTitle: source.title,
    sourceUrl: source.url,
    sourceCheckedAt: checkedAt,
    sourceNote: note
  }
}

function school(value) {
  return {
    tags: [],
    dataVersion: APP_CONFIG.schoolData.version,
    ...value
  }
}

const cityIndicatorNote = '核对字段：学校或校区名称、普通高中指标生计划列项；本条只展示已在公开文件中明确的基础字段。'
const cityAdmissionNote = '核对字段：学校名称、招生区域和普通高中招生批次；未统一核实的地址、联系方式不展示。'
const autonomousNote = '核对字段：学校名称、校区或项目名称、普通高中自主招生相关公开信息；未统一核实的地址、联系方式不展示。'

const schools = [
  school({
    id: 'suzhou_high_school',
    name: '江苏省苏州中学校',
    aliases: ['苏州中学', '苏中'],
    district: '姑苏区',
    schoolType: '普通高中',
    tags: ['市区招生', '指标生计划'],
    ...sourceFields(SOURCES.suzhou2026Admissions, cityAdmissionNote)
  }),
  school({
    id: 'suzhou_high_school_sip',
    name: '江苏省苏州中学园区校',
    aliases: ['苏中园区校'],
    district: '工业园区',
    schoolType: '普通高中',
    campus: '园区校',
    tags: ['市区招生', '指标生计划'],
    ...sourceFields(SOURCES.suzhou2026Indicator, cityIndicatorNote)
  }),
  school({
    id: 'suzhou_no10_high_school',
    name: '江苏省苏州第十中学校',
    aliases: ['苏州十中'],
    district: '姑苏区',
    schoolType: '普通高中',
    campus: '本部',
    tags: ['姑苏区', '指标生计划'],
    ...sourceFields(SOURCES.suzhou2026Indicator, cityIndicatorNote)
  }),
  school({
    id: 'suzhou_no10_high_school_jinchang',
    name: '江苏省苏州第十中学校金阊校区',
    aliases: ['苏州十中金阊校区'],
    district: '姑苏区',
    schoolType: '普通高中',
    campus: '金阊校区',
    tags: ['姑苏区', '指标生计划'],
    ...sourceFields(SOURCES.suzhou2026Indicator, cityIndicatorNote)
  }),
  school({
    id: 'suzhou_no1_high_school',
    name: '江苏省苏州第一中学校',
    aliases: ['苏州一中'],
    district: '姑苏区',
    schoolType: '普通高中',
    tags: ['姑苏区', '指标生计划'],
    ...sourceFields(SOURCES.suzhou2026Indicator, cityIndicatorNote)
  }),
  school({
    id: 'suzhou_no3_high_school',
    name: '苏州市第三中学校',
    aliases: ['苏州三中'],
    district: '姑苏区',
    schoolType: '普通高中',
    tags: ['姑苏区', '指标生计划'],
    ...sourceFields(SOURCES.suzhou2026Indicator, cityIndicatorNote)
  }),
  school({
    id: 'suzhou_no6_high_school',
    name: '苏州市第六中学校',
    aliases: ['苏州六中'],
    district: '姑苏区',
    schoolType: '普通高中',
    tags: ['姑苏区', '专业特长类'],
    programs: ['普通高中专业特长类相关招生以当年主管部门文件为准'],
    ...sourceFields(SOURCES.suzhou2026Admissions, cityAdmissionNote)
  }),
  school({
    id: 'suda_affiliated_high_school',
    name: '苏州大学附属中学',
    aliases: ['苏大附中'],
    district: '工业园区',
    schoolType: '普通高中',
    campus: '东振路校区',
    tags: ['工业园区', '指标生计划'],
    programs: ['费孝通班'],
    ...sourceFields(SOURCES.suzhou2026Autonomous, autonomousNote)
  }),
  school({
    id: 'suda_affiliated_high_school_shengpu',
    name: '苏州大学附属中学胜浦路校区',
    aliases: ['苏大附中胜浦路校区'],
    district: '工业园区',
    schoolType: '普通高中',
    campus: '胜浦路校区',
    tags: ['工业园区', '指标生计划'],
    ...sourceFields(SOURCES.suzhou2026Indicator, cityIndicatorNote)
  }),
  school({
    id: 'nuaa_suzhou_affiliated_high_school',
    name: '南京航空航天大学苏州附属中学',
    aliases: ['南航苏附'],
    district: '工业园区',
    schoolType: '普通高中',
    campus: '星湖街校区',
    tags: ['工业园区', '指标生计划'],
    ...sourceFields(SOURCES.suzhou2026Indicator, cityIndicatorNote)
  }),
  school({
    id: 'nuaa_suzhou_affiliated_high_school_weiting',
    name: '南京航空航天大学苏州附属中学唯亭校区',
    aliases: ['南航苏附唯亭校区'],
    district: '工业园区',
    schoolType: '普通高中',
    campus: '唯亭校区',
    tags: ['工业园区', '指标生计划'],
    ...sourceFields(SOURCES.suzhou2026Indicator, cityIndicatorNote)
  }),
  school({
    id: 'xjtu_suzhou_affiliated_high_school',
    name: '西安交通大学苏州附属中学',
    aliases: ['西交苏附'],
    district: '工业园区',
    schoolType: '普通高中',
    campus: '方洲路校区',
    tags: ['工业园区', '指标生计划'],
    programs: ['纳米科学人才实验班'],
    ...sourceFields(SOURCES.suzhou2026Autonomous, autonomousNote)
  }),
  school({
    id: 'xjtu_suzhou_affiliated_high_school_puhui',
    name: '西安交通大学苏州附属中学普惠路校区',
    aliases: ['西交苏附普惠路校区'],
    district: '工业园区',
    schoolType: '普通高中',
    campus: '普惠路校区',
    tags: ['工业园区', '指标生计划'],
    programs: ['钱学森大成实验班'],
    ...sourceFields(SOURCES.suzhou2026Autonomous, autonomousNote)
  }),
  school({
    id: 'xjtu_suzhou_affiliated_high_school_xietang',
    name: '西安交通大学苏州附属中学斜塘校区',
    aliases: ['西交苏附斜塘校区'],
    district: '工业园区',
    schoolType: '普通高中',
    campus: '斜塘校区',
    tags: ['工业园区', '指标生计划'],
    ...sourceFields(SOURCES.suzhou2026Indicator, cityIndicatorNote)
  }),
  school({
    id: 'xinghai_experimental_high_school',
    name: '苏州工业园区星海实验高级中学',
    aliases: ['星海实验高级中学'],
    district: '工业园区',
    schoolType: '普通高中',
    campus: '苏茜路校区',
    tags: ['工业园区', '指标生计划'],
    programs: ['生命科学课程实验班'],
    ...sourceFields(SOURCES.suzhou2026Autonomous, autonomousNote)
  }),
  school({
    id: 'xinghai_experimental_high_school_shenhu',
    name: '苏州工业园区星海实验高级中学沈浒路校区',
    aliases: ['星海实验沈浒路校区'],
    district: '工业园区',
    schoolType: '普通高中',
    campus: '沈浒路校区',
    tags: ['工业园区', '指标生计划'],
    ...sourceFields(SOURCES.suzhou2026Indicator, cityIndicatorNote)
  }),
  school({
    id: 'rdfz_suzhou_school',
    name: '人大附中苏州学校',
    district: '工业园区',
    schoolType: '普通高中',
    tags: ['工业园区', '提前录取'],
    programs: ['未来科技英才战略实验班'],
    ...sourceFields(SOURCES.suzhou2026Autonomous, autonomousNote)
  }),
  school({
    id: 'suzhou_experimental_high_school',
    name: '江苏省苏州实验中学',
    aliases: ['新区实验'],
    district: '高新区',
    schoolType: '普通高中',
    campus: '本部',
    tags: ['高新区', '指标生计划'],
    programs: ['南京大学软件工程实验班', '中科创新实验班'],
    ...sourceFields(SOURCES.suzhou2026Autonomous, autonomousNote)
  }),
  school({
    id: 'suzhou_experimental_high_school_science_city',
    name: '江苏省苏州实验中学科技城校',
    aliases: ['新区实验科技城校'],
    district: '高新区',
    schoolType: '普通高中',
    campus: '科技城校区',
    tags: ['高新区', '指标生计划'],
    programs: ['智能工程实验班'],
    ...sourceFields(SOURCES.suzhou2026Autonomous, autonomousNote)
  }),
  school({
    id: 'suzhou_experimental_high_school_taihu_science_city',
    name: '江苏省苏州实验中学太湖科学城校区',
    aliases: ['新区实验太湖科学城校区'],
    district: '高新区',
    schoolType: '普通高中',
    campus: '太湖科学城校区',
    tags: ['高新区', '指标生计划'],
    ...sourceFields(SOURCES.suzhou2026Indicator, cityIndicatorNote)
  }),
  school({
    id: 'suzhou_new_district_no1_high_school',
    name: '苏州高新区第一中学',
    aliases: ['新区一中'],
    district: '高新区',
    schoolType: '普通高中',
    campus: '本部',
    tags: ['高新区', '指标生计划'],
    ...sourceFields(SOURCES.suzhou2026Indicator, cityIndicatorNote)
  }),
  school({
    id: 'suzhou_new_district_no1_high_school_science_city',
    name: '苏州高新区第一中学科技城校区',
    aliases: ['新区一中科技城校区'],
    district: '高新区',
    schoolType: '普通高中',
    campus: '科技城校区',
    tags: ['高新区', '指标生计划'],
    ...sourceFields(SOURCES.suzhou2026Indicator, cityIndicatorNote)
  }),
  school({
    id: 'wuxian_high_school',
    name: '苏州市吴县中学',
    aliases: ['吴县中学'],
    district: '高新区',
    schoolType: '普通高中',
    campus: '本部',
    tags: ['高新区', '指标生计划'],
    ...sourceFields(SOURCES.suzhou2026Indicator, cityIndicatorNote)
  }),
  school({
    id: 'wuxian_high_school_jingshan',
    name: '苏州市吴县中学景山校区',
    aliases: ['吴县中学景山校区'],
    district: '高新区',
    schoolType: '普通高中',
    campus: '景山校区',
    tags: ['高新区', '指标生计划'],
    ...sourceFields(SOURCES.suzhou2026Indicator, cityIndicatorNote)
  }),
  school({
    id: 'wuxian_high_school_huguan',
    name: '苏州市吴县中学浒关校区',
    aliases: ['吴县中学浒关校区'],
    district: '高新区',
    schoolType: '普通高中',
    campus: '浒关校区',
    tags: ['高新区', '指标生计划'],
    ...sourceFields(SOURCES.suzhou2026Indicator, cityIndicatorNote)
  }),
  school({
    id: 'mudu_senior_high_school',
    name: '江苏省木渎高级中学',
    aliases: ['木渎中学', '木渎高级中学'],
    district: '吴中区',
    schoolType: '普通高中',
    tags: ['吴中区', '提前录取'],
    programs: ['培东实验项目'],
    ...sourceFields(SOURCES.suzhou2026Autonomous, autonomousNote)
  }),
  school({
    id: 'suyuan_senior_high_school',
    name: '苏州市吴中区苏苑高级中学',
    aliases: ['苏苑高级中学'],
    district: '吴中区',
    schoolType: '普通高中',
    tags: ['吴中区', '专业特长类'],
    programs: ['清华美术班'],
    ...sourceFields(SOURCES.suzhou2026Admissions, cityAdmissionNote)
  }),
  school({
    id: 'jiangsu_foreign_language_school',
    name: '江苏省外国语学校',
    district: '吴中区',
    schoolType: '普通高中',
    tags: ['吴中区', '指标生计划'],
    ...sourceFields(SOURCES.suzhou2026Admissions, cityAdmissionNote)
  }),
  school({
    id: 'luzhi_senior_high_school',
    name: '苏州市吴中区甪直高级中学',
    aliases: ['甪直高级中学'],
    district: '吴中区',
    schoolType: '普通高中',
    tags: ['吴中区', '专业特长类'],
    ...sourceFields(SOURCES.suzhou2026Admissions, cityAdmissionNote)
  }),
  school({
    id: 'huazhong_normal_suzhou_experimental_high_school',
    name: '华中师范大学苏州实验高级中学',
    aliases: ['华师大苏州实验高级中学'],
    district: '吴中区',
    schoolType: '普通高中',
    tags: ['吴中区', '自主招生'],
    programs: ['华一实验项目'],
    ...sourceFields(SOURCES.suzhou2026Autonomous, autonomousNote)
  }),
  school({
    id: 'dongshan_senior_high_school',
    name: '苏州市吴中区东山中学',
    aliases: ['东山中学'],
    district: '吴中区',
    schoolType: '普通高中',
    tags: ['吴中区', '专业特长类'],
    ...sourceFields(SOURCES.suzhou2026Admissions, cityAdmissionNote)
  }),
  school({
    id: 'zhenze_high_school',
    name: '江苏省震泽中学',
    district: '吴江区',
    schoolType: '普通高中',
    tags: ['吴江区', '提前录取'],
    programs: ['杨嘉墀创新实验班'],
    ...sourceFields(SOURCES.suzhou2026Autonomous, autonomousNote)
  }),
  school({
    id: 'zhenze_high_school_shifanqu',
    name: '江苏省震泽中学示范区校区',
    district: '吴江区',
    schoolType: '普通高中',
    campus: '示范区校区',
    tags: ['吴江区', '提前录取'],
    ...sourceFields(SOURCES.suzhou2026Admissions, cityAdmissionNote)
  }),
  school({
    id: 'wujiang_high_school',
    name: '吴江中学',
    district: '吴江区',
    schoolType: '普通高中',
    tags: ['吴江区', '自主招生'],
    programs: ['明伦书院班'],
    ...sourceFields(SOURCES.suzhou2026Autonomous, autonomousNote)
  }),
  school({
    id: 'wujiang_senior_high_school',
    name: '吴江高级中学',
    district: '吴江区',
    schoolType: '普通高中',
    tags: ['吴江区', '市区招生'],
    ...sourceFields(SOURCES.suzhou2026Admissions, cityAdmissionNote)
  }),
  school({
    id: 'wujiang_xinsheng_experimental_school',
    name: '苏州市吴江区新胜实验学校',
    district: '吴江区',
    schoolType: '普通高中',
    tags: ['吴江区', '自主招生'],
    programs: ['新胜项目'],
    ...sourceFields(SOURCES.suzhou2026Autonomous, autonomousNote)
  }),
  school({
    id: 'wujiang_qingyun_experimental_school',
    name: '苏州市吴江区青云实验中学',
    aliases: ['青云实验中学'],
    district: '吴江区',
    schoolType: '普通高中',
    tags: ['吴江区', '专业特长类'],
    ...sourceFields(SOURCES.suzhou2026Admissions, cityAdmissionNote)
  }),
  school({
    id: 'fenhu_senior_high_school',
    name: '汾湖高级中学',
    district: '吴江区',
    schoolType: '普通高中',
    tags: ['吴江区', '专业特长类'],
    ...sourceFields(SOURCES.suzhou2026Admissions, cityAdmissionNote)
  }),
  school({
    id: 'huangdai_high_school',
    name: '江苏省黄埭中学',
    district: '相城区',
    schoolType: '普通高中',
    tags: ['相城区', '提前录取'],
    programs: ['启新班', '院士班'],
    ...sourceFields(SOURCES.suzhou2026Admissions, cityAdmissionNote)
  }),
  school({
    id: 'lumu_high_school',
    name: '苏州市相城区陆慕高级中学',
    aliases: ['陆慕高级中学'],
    district: '相城区',
    schoolType: '普通高中',
    tags: ['相城区', '提前录取'],
    programs: ['志远班'],
    ...sourceFields(SOURCES.suzhou2026Admissions, cityAdmissionNote)
  }),
  school({
    id: 'xiangcheng_high_school',
    name: '相城中学',
    district: '相城区',
    schoolType: '普通高中',
    tags: ['相城区', '自主招生'],
    programs: ['江苏省苏州中学相城实验项目'],
    ...sourceFields(SOURCES.suzhou2026Autonomous, autonomousNote)
  }),
  school({
    id: 'suzhou_university_experimental_school',
    name: '苏州大学实验学校',
    district: '相城区',
    schoolType: '普通高中',
    tags: ['相城区', '提前录取'],
    programs: ['东吴班'],
    ...sourceFields(SOURCES.suzhou2026Admissions, cityAdmissionNote)
  }),
  school({
    id: 'wangting_high_school',
    name: '苏州市相城区望亭中学',
    aliases: ['望亭中学'],
    district: '相城区',
    schoolType: '普通高中',
    tags: ['相城区', '专业特长类'],
    ...sourceFields(SOURCES.suzhou2026Admissions, cityAdmissionNote)
  }),
  school({
    id: 'changshu_high_school',
    name: '江苏省常熟中学',
    district: '常熟',
    schoolType: '高级中学',
    ownership: '县级教育部门',
    address: '常熟市汇文路2号',
    tags: ['常熟', '政府名录'],
    ...sourceFields(SOURCES.changshuList2024, '核对字段：学校类型、举办者类型、学校名称、地址。')
  }),
  school({
    id: 'changshu_city_high_school',
    name: '常熟市中学',
    district: '常熟',
    schoolType: '高级中学',
    ownership: '县级教育部门',
    address: '常熟市新世纪大道1060号',
    tags: ['常熟', '政府名录'],
    ...sourceFields(SOURCES.changshuList2024, '核对字段：学校类型、举办者类型、学校名称、地址。')
  }),
  school({
    id: 'changshu_foreign_language_school',
    name: '常熟外国语学校',
    district: '常熟',
    schoolType: '高级中学',
    ownership: '县级教育部门',
    address: '常熟市虞山北路193号',
    tags: ['常熟', '政府名录'],
    ...sourceFields(SOURCES.changshuList2024, '核对字段：学校类型、举办者类型、学校名称、地址。')
  }),
  school({
    id: 'changshu_shanghu_high_school',
    name: '常熟市尚湖高级中学',
    district: '常熟',
    schoolType: '高级中学',
    ownership: '县级教育部门',
    address: '常熟市虞山街道环湖南路139号',
    tags: ['常熟', '政府名录'],
    ...sourceFields(SOURCES.changshuList2024, '核对字段：学校类型、举办者类型、学校名称、地址。')
  }),
  school({
    id: 'changshu_haiyu_high_school',
    name: '常熟市海虞高级中学',
    district: '常熟',
    schoolType: '高级中学',
    ownership: '县级教育部门',
    address: '常熟市海虞镇海阳路75号',
    tags: ['常熟', '政府名录'],
    ...sourceFields(SOURCES.changshuList2024, '核对字段：学校类型、举办者类型、学校名称、地址。')
  }),
  school({
    id: 'changshu_hupu_high_school',
    name: '常熟市浒浦高级中学',
    district: '常熟',
    schoolType: '高级中学',
    ownership: '县级教育部门',
    address: '常熟经济技术开发区龙腾南路11号',
    tags: ['常熟', '政府名录'],
    ...sourceFields(SOURCES.changshuList2024, '核对字段：学校类型、举办者类型、学校名称、地址。')
  }),
  school({
    id: 'changshu_wangganchang_high_school',
    name: '常熟市王淦昌高级中学',
    district: '常熟',
    schoolType: '高级中学',
    ownership: '县级教育部门',
    address: '常熟市支塘镇支董路1号',
    tags: ['常熟', '政府名录'],
    ...sourceFields(SOURCES.changshuList2024, '核对字段：学校类型、举办者类型、学校名称、地址。')
  }),
  school({
    id: 'changshu_meili_high_school',
    name: '常熟市梅李高级中学',
    district: '常熟',
    schoolType: '高级中学',
    ownership: '县级教育部门',
    address: '常熟市梅李镇学府路1号',
    tags: ['常熟', '政府名录'],
    ...sourceFields(SOURCES.changshuList2024, '核对字段：学校类型、举办者类型、学校名称、地址。')
  }),
  school({
    id: 'changshu_lunhua_high_school',
    name: '常熟市伦华高级中学',
    district: '常熟',
    schoolType: '高级中学',
    ownership: '民办',
    address: '常熟市琴川街道青龙路28号',
    tags: ['常熟', '政府名录'],
    ...sourceFields(SOURCES.changshuList2024, '核对字段：学校类型、举办者类型、学校名称、地址。')
  }),
  school({
    id: 'changshu_shihua_high_school',
    name: '常熟世华高级中学',
    district: '常熟',
    schoolType: '高级中学',
    ownership: '民办',
    address: '常熟市东南街道羿家路8号',
    tags: ['常熟', '政府名录'],
    ...sourceFields(SOURCES.changshuList2024, '核对字段：学校类型、举办者类型、学校名称、地址。')
  }),
  school({
    id: 'changshu_kangqiao_school',
    name: '常熟康桥学校',
    district: '常熟',
    schoolType: '十二年一贯制学校',
    ownership: '民办',
    address: '常熟市碧溪街道松姿路6号',
    tags: ['常熟', '政府名录'],
    ...sourceFields(SOURCES.changshuList2024, '核对字段：学校类型、举办者类型、学校名称、地址。')
  }),
  school({
    id: 'changshu_suchang_foreign_language_school',
    name: '常熟市苏常外国语学校',
    district: '常熟',
    schoolType: '十二年一贯制学校',
    ownership: '民办',
    address: '常熟市海虞镇王市路369号',
    tags: ['常熟', '政府名录'],
    ...sourceFields(SOURCES.changshuList2024, '核对字段：学校类型、举办者类型、学校名称、地址。')
  })
]

module.exports = { schools, SOURCES }
