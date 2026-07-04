const { APP_CONFIG } = require('../config/app-config')

const checkedAt = APP_CONFIG.schoolData.sourceCheckedAt

const SOURCES = {
  suzhou2026: {
    title: '苏州市教育局：关于做好2026年苏州市区各类高级中等学校招生工作的通知',
    url: 'https://www.suzhou.gov.cn/szsrmzf/bmwj/202605/4a9271ac8d7049f8ac0e6f310e79bc57.shtml'
  },
  changshuList2024: {
    title: '常熟市普通高中名录（数据截至2024年8月）',
    url: 'https://www.suzhou.gov.cn/szsrmzf/zxxjy/202409/eb5864363ba14c48855813d4fb8f0078.shtml'
  },
  suzhouHigh: {
    title: '江苏省苏州中学校官网',
    url: 'https://www.szzx1000.cn/'
  },
  suzhouNo10: {
    title: '江苏省苏州第十中学校官网',
    url: 'https://www.nths.cn/'
  },
  suzhouNo1: {
    title: '江苏省苏州第一中学校官网',
    url: 'https://www.sz1z.com/'
  },
  suzhouNo6: {
    title: '苏州市第六中学校官网',
    url: 'https://sz6z.suzhou.edu.cn/sy.htm'
  },
  suzhouExperiment: {
    title: '江苏省苏州实验中学校官网',
    url: 'https://szsyzx.jssnd.edu.cn/'
  },
  xinquNo1: {
    title: '苏州高新区第一中学官网',
    url: 'https://xqyz.jssnd.edu.cn/'
  },
  wuxian: {
    title: '苏州市吴县中学官网',
    url: 'https://wxzx.jssnd.edu.cn/'
  },
  mudu: {
    title: '江苏省木渎高级中学官网',
    url: 'https://www.muduhs.com/'
  },
  zhenzeGov: {
    title: '苏州市人民政府：江苏省震泽中学建校100周年活动举行',
    url: 'https://www.suzhou.gov.cn/szsrmzf/szyw/202310/400fe3908c824ba7b3a0c01a54ac4e7d.shtml'
  },
  taicangGov: {
    title: '苏州市人民政府：江苏省太仓高级中学高质量发展大会举行',
    url: 'https://www.suzhou.gov.cn/szsrmzf/zxxjy/202512/66a96e4c02ca4d398476c88b00ac6757.shtml'
  },
  liangfeng: {
    title: '江苏省梁丰高级中学官网',
    url: 'https://jslfgz.zjgedu.cn/'
  },
  chsi: {
    title: '阳光高考中学信息库',
    url: 'https://gaokao.chsi.com.cn/zx/sch/home.action?ssdm=32'
  },
  xiangchengEdu: {
    title: '相城区教育信息网',
    url: 'https://www.xcjyxx.com/'
  },
  kunshanGov: {
    title: '昆山市普通高中招生政策公开信息',
    url: 'https://www.ksrmtzx.com/news/detail/45296'
  }
}

function sourceFields(source, dataKind, dataStatus, note) {
  return {
    dataKind,
    dataStatus,
    sourceTitle: source.title,
    sourceUrl: source.url,
    sourceCheckedAt: checkedAt,
    sourceNote: note
  }
}

function school(value) {
  return {
    educationStage: '高中阶段',
    officialWebsite: '',
    tags: [],
    mapSearchKeyword: `${value.name} 苏州`,
    dataVersion: APP_CONFIG.schoolData.version,
    ...value
  }
}

const schools = [
  school({
    id: 'suzhou_high_school',
    name: '江苏省苏州中学校',
    district: '姑苏区',
    schoolType: '普通高中',
    ownership: '公办',
    boardingType: '待核实',
    intro: '学校基础信息来自学校官网公开页面，本版本仅展示基础信息和来源。',
    tags: ['学校官网', '市直属', '普通高中'],
    officialWebsite: SOURCES.suzhouHigh.url,
    ...sourceFields(SOURCES.suzhouHigh, 'official_site', '官网资料', '已核对学校官网首页；住宿、联系方式和地址坐标未进入当前版本。')
  }),
  school({
    id: 'suzhou_no10_high_school',
    name: '江苏省苏州第十中学校',
    district: '姑苏区',
    schoolType: '普通高中',
    ownership: '公办',
    boardingType: '待核实',
    intro: '学校基础信息来自学校官网公开页面，本版本仅展示基础信息和来源。',
    tags: ['学校官网', '姑苏区', '普通高中'],
    officialWebsite: SOURCES.suzhouNo10.url,
    ...sourceFields(SOURCES.suzhouNo10, 'official_site', '官网资料', '已核对学校官网首页；校区、住宿等细项需后续人工复核。')
  }),
  school({
    id: 'suzhou_no1_high_school',
    name: '江苏省苏州第一中学校',
    district: '姑苏区',
    schoolType: '普通高中',
    ownership: '公办',
    boardingType: '待核实',
    intro: '学校基础信息来自学校官网公开页面，本版本仅展示基础信息和来源。',
    tags: ['学校官网', '姑苏区', '普通高中'],
    officialWebsite: SOURCES.suzhouNo1.url,
    ...sourceFields(SOURCES.suzhouNo1, 'official_site', '官网资料', '已核对学校官网首页；不展示联系方式和坐标。')
  }),
  school({
    id: 'suzhou_no3_high_school',
    name: '苏州市第三中学校',
    district: '姑苏区',
    schoolType: '普通高中',
    ownership: '待核实',
    boardingType: '待核实',
    intro: '学校列入苏州市区高中阶段招生相关公开信息，本版本先保留基础名称和区域。',
    tags: ['政府公开', '姑苏区', '待复核'],
    ...sourceFields(SOURCES.suzhou2026, 'government_public', '政府公开资料', '学校官网入口和住宿状态需继续复核。')
  }),
  school({
    id: 'suzhou_no6_high_school',
    name: '苏州市第六中学校',
    district: '姑苏区',
    schoolType: '普通高中',
    ownership: '公办',
    boardingType: '待核实',
    intro: '学校基础信息来自学校官网公开页面，本版本仅展示基础信息和来源。',
    tags: ['学校官网', '艺术特色', '普通高中'],
    officialWebsite: SOURCES.suzhouNo6.url,
    ...sourceFields(SOURCES.suzhouNo6, 'official_site', '官网资料', '已核对学校官网首页；艺术类招生信息不进入当前功能判断。')
  }),
  school({
    id: 'rdfz_suzhou_school',
    name: '人大附中苏州学校',
    district: '工业园区',
    schoolType: '普通高中',
    ownership: '待核实',
    boardingType: '待核实',
    intro: '学校名称来自苏州市区高级中等学校招生公开文件，本版本只做基础信息整理。',
    tags: ['政府公开', '工业园区', '待复核'],
    ...sourceFields(SOURCES.suzhou2026, 'government_public', '政府公开资料', '学校官网、办学性质、住宿状态需继续复核。')
  }),
  school({
    id: 'suda_affiliated_high_school',
    name: '苏州大学附属中学',
    district: '工业园区',
    schoolType: '普通高中',
    ownership: '待核实',
    boardingType: '待核实',
    intro: '学校基础信息来自公开中学信息库和苏州市区招生公开文件，本版本不展示未核实细项。',
    tags: ['公开资料', '工业园区', '普通高中'],
    ...sourceFields(SOURCES.chsi, 'official_public', '政府公开资料', '学校官网入口、住宿状态和联系方式需继续复核。')
  }),
  school({
    id: 'xjtu_suzhou_affiliated_high_school',
    name: '西安交通大学苏州附属中学',
    district: '工业园区',
    schoolType: '普通高中',
    ownership: '待核实',
    boardingType: '待核实',
    intro: '学校名称来自苏州市区高级中等学校招生公开文件，本版本只做基础信息整理。',
    tags: ['政府公开', '工业园区', '待复核'],
    officialWebsite: 'http://xjdszfz.sipedu.org',
    ...sourceFields(SOURCES.suzhou2026, 'government_public', '政府公开资料', '学校官网和具体校区信息需继续复核。')
  }),
  school({
    id: 'nuaa_suzhou_affiliated_high_school',
    name: '南京航空航天大学苏州附属中学',
    district: '工业园区',
    schoolType: '普通高中',
    ownership: '待核实',
    boardingType: '待核实',
    intro: '学校名称来自苏州市区高级中等学校招生公开文件，本版本只做基础信息整理。',
    tags: ['政府公开', '工业园区', '待复核'],
    officialWebsite: 'http://nhszfz.sipedu.cn',
    ...sourceFields(SOURCES.suzhou2026, 'government_public', '政府公开资料', '学校官网和具体校区信息需继续复核。')
  }),
  school({
    id: 'xinghai_experimental_high_school',
    name: '苏州工业园区星海实验高级中学',
    district: '工业园区',
    schoolType: '普通高中',
    ownership: '待核实',
    boardingType: '待核实',
    intro: '学校名称来自苏州市区高级中等学校招生公开文件，本版本只做基础信息整理。',
    tags: ['政府公开', '工业园区', '待复核'],
    ...sourceFields(SOURCES.suzhou2026, 'government_public', '政府公开资料', '学校官网、校区和办学性质需继续复核。')
  }),
  school({
    id: 'suzhou_experimental_high_school',
    name: '江苏省苏州实验中学',
    district: '高新区',
    schoolType: '普通高中',
    ownership: '公办',
    boardingType: '待核实',
    intro: '学校基础信息来自学校官网公开页面，本版本仅展示基础信息和来源。',
    tags: ['学校官网', '高新区', '普通高中'],
    officialWebsite: SOURCES.suzhouExperiment.url,
    ...sourceFields(SOURCES.suzhouExperiment, 'official_site', '官网资料', '已核对学校官网首页；校区和住宿状态需继续复核。')
  }),
  school({
    id: 'suzhou_new_district_no1_high_school',
    name: '苏州高新区第一中学',
    district: '高新区',
    schoolType: '普通高中',
    ownership: '公办',
    boardingType: '待核实',
    intro: '学校基础信息来自学校官网公开页面，本版本仅展示基础信息和来源。',
    tags: ['学校官网', '高新区', '普通高中'],
    officialWebsite: SOURCES.xinquNo1.url,
    ...sourceFields(SOURCES.xinquNo1, 'official_site', '官网资料', '已核对学校官网首页；校区和住宿状态需继续复核。')
  }),
  school({
    id: 'wuxian_high_school',
    name: '苏州市吴县中学',
    district: '高新区',
    schoolType: '普通高中',
    ownership: '公办',
    boardingType: '待核实',
    intro: '学校基础信息来自学校官网公开页面，本版本仅展示基础信息和来源。',
    tags: ['学校官网', '高新区', '普通高中'],
    officialWebsite: SOURCES.wuxian.url,
    ...sourceFields(SOURCES.wuxian, 'official_site', '官网资料', '已核对学校官网首页；校区和住宿状态需继续复核。')
  }),
  school({
    id: 'mudu_senior_high_school',
    name: '江苏省木渎高级中学',
    district: '吴中区',
    schoolType: '普通高中',
    ownership: '公办',
    boardingType: '待核实',
    intro: '学校基础信息来自学校官网公开页面，本版本仅展示基础信息和来源。',
    tags: ['学校官网', '吴中区', '普通高中'],
    officialWebsite: SOURCES.mudu.url,
    ...sourceFields(SOURCES.mudu, 'official_site', '官网资料', '已核对学校官网入口；住宿、联系方式和地址坐标未进入当前版本。')
  }),
  school({
    id: 'suyuan_senior_high_school',
    name: '苏州市吴中区苏苑高级中学',
    district: '吴中区',
    schoolType: '普通高中',
    ownership: '待核实',
    boardingType: '待核实',
    intro: '学校名称来自苏州市区高级中等学校招生公开文件，本版本先保留基础名称和区域。',
    tags: ['政府公开', '吴中区', '待复核'],
    ...sourceFields(SOURCES.suzhou2026, 'government_public', '政府公开资料', '学校官网、办学性质和住宿状态需继续复核。')
  }),
  school({
    id: 'jiangsu_foreign_language_school',
    name: '江苏省外国语学校',
    district: '吴中区',
    schoolType: '完全中学',
    ownership: '待核实',
    boardingType: '待核实',
    intro: '学校名称来自苏州市区高级中等学校招生公开文件，本版本先保留基础名称和区域。',
    tags: ['政府公开', '吴中区', '待复核'],
    ...sourceFields(SOURCES.suzhou2026, 'government_public', '政府公开资料', '学校官网、办学性质和高中阶段细项需继续复核。')
  }),
  school({
    id: 'huangdai_high_school',
    name: '江苏省黄埭中学',
    district: '相城区',
    schoolType: '普通高中',
    ownership: '公办',
    boardingType: '待核实',
    intro: '学校列入苏州市区高中阶段招生公开文件，本版本仅展示基础信息和来源。',
    tags: ['政府公开', '相城区', '普通高中'],
    officialWebsite: 'http://hdzx.xcjyxx.com',
    ...sourceFields(SOURCES.suzhou2026, 'government_public', '政府公开资料', '官网入口来自相城区教育信息网相关公开入口，住宿状态需继续复核。')
  }),
  school({
    id: 'lumu_high_school',
    name: '苏州市相城区陆慕高级中学',
    district: '相城区',
    schoolType: '普通高中',
    ownership: '公办',
    boardingType: '待核实',
    intro: '学校列入苏州市区高中阶段招生公开文件，本版本仅展示基础信息和来源。',
    tags: ['政府公开', '相城区', '普通高中'],
    officialWebsite: 'http://lmgjzx.xcjyxx.com',
    ...sourceFields(SOURCES.suzhou2026, 'government_public', '政府公开资料', '官网入口来自相城区教育信息网相关公开入口，住宿状态需继续复核。')
  }),
  school({
    id: 'xiangcheng_high_school',
    name: '相城中学',
    district: '相城区',
    schoolType: '普通高中',
    ownership: '待核实',
    boardingType: '待核实',
    intro: '学校名称来自相城区教育信息网和苏州市区招生公开信息，本版本先保留基础名称和区域。',
    tags: ['政府公开', '相城区', '待复核'],
    ...sourceFields(SOURCES.xiangchengEdu, 'government_public', '政府公开资料', '高中部、办学性质和住宿状态需继续复核。')
  }),
  school({
    id: 'zhenze_high_school',
    name: '江苏省震泽中学',
    district: '吴江区',
    schoolType: '普通高中',
    ownership: '公办',
    boardingType: '待核实',
    intro: '学校基础信息来自苏州市人民政府公开报道，本版本仅展示基础信息和来源。',
    tags: ['政府公开', '吴江区', '普通高中'],
    officialWebsite: 'https://zzzx.wjjyxxw.com',
    ...sourceFields(SOURCES.zhenzeGov, 'government_public', '政府公开资料', '政府公开报道已核对学校名称；官网、住宿和校区细项需继续复核。')
  }),
  school({
    id: 'wujiang_high_school',
    name: '吴江中学',
    district: '吴江区',
    schoolType: '普通高中',
    ownership: '待核实',
    boardingType: '待核实',
    intro: '学校名称来自苏州市区高中阶段招生公开文件，本版本先保留基础名称和区域。',
    tags: ['政府公开', '吴江区', '待复核'],
    officialWebsite: 'https://wjzx.wjjyxxw.com',
    ...sourceFields(SOURCES.suzhou2026, 'government_public', '政府公开资料', '学校官网入口、办学性质和住宿状态需继续复核。')
  }),
  school({
    id: 'wujiang_senior_high_school',
    name: '吴江高级中学',
    district: '吴江区',
    schoolType: '普通高中',
    ownership: '待核实',
    boardingType: '待核实',
    intro: '学校名称来自苏州市区高中阶段招生公开文件，本版本先保留基础名称和区域。',
    tags: ['政府公开', '吴江区', '待复核'],
    officialWebsite: 'https://wjgjzx.wjjyxxw.com',
    ...sourceFields(SOURCES.suzhou2026, 'government_public', '政府公开资料', '学校官网入口、办学性质和住宿状态需继续复核。')
  }),
  school({
    id: 'kunshan_high_school',
    name: '江苏省昆山中学',
    district: '昆山',
    schoolType: '普通高中',
    ownership: '公办',
    boardingType: '待核实',
    intro: '学校基础信息来自昆山市普通高中招生政策公开信息，本版本仅展示基础信息和来源。',
    tags: ['政府公开', '昆山', '普通高中'],
    officialWebsite: 'https://kz.ksecloud.cn',
    ...sourceFields(SOURCES.kunshanGov, 'government_public', '政府公开资料', '学校官网入口、住宿状态和联系方式需继续复核。')
  }),
  school({
    id: 'kunshan_zhenchuan_high_school',
    name: '昆山震川高级中学',
    district: '昆山',
    schoolType: '普通高中',
    ownership: '公办',
    boardingType: '待核实',
    intro: '学校基础信息来自昆山市普通高中招生政策公开信息，本版本仅展示基础信息和来源。',
    tags: ['政府公开', '昆山', '普通高中'],
    officialWebsite: 'https://e-zc.ksecloud.cn',
    ...sourceFields(SOURCES.kunshanGov, 'government_public', '政府公开资料', '学校官网入口、住宿状态和联系方式需继续复核。')
  }),
  school({
    id: 'kunshan_no1_high_school',
    name: '昆山市第一中学',
    district: '昆山',
    schoolType: '普通高中',
    ownership: '公办',
    boardingType: '待核实',
    intro: '学校基础信息来自昆山市普通高中招生政策公开信息，本版本仅展示基础信息和来源。',
    tags: ['政府公开', '昆山', '普通高中'],
    officialWebsite: 'https://ksyz.ksedu.cn/index.htm',
    ...sourceFields(SOURCES.kunshanGov, 'government_public', '政府公开资料', '学校官网入口、住宿状态和联系方式需继续复核。')
  }),
  school({
    id: 'kunshan_development_zone_high_school',
    name: '昆山经济技术开发区高级中学',
    district: '昆山',
    schoolType: '普通高中',
    ownership: '公办',
    boardingType: '待核实',
    intro: '学校基础信息来自昆山市普通高中招生政策公开信息，本版本仅展示基础信息和来源。',
    tags: ['政府公开', '昆山', '普通高中'],
    officialWebsite: 'https://kskg.ksecloud.cn',
    ...sourceFields(SOURCES.kunshanGov, 'government_public', '政府公开资料', '学校官网入口、住宿状态和联系方式需继续复核。')
  }),
  school({
    id: 'changshu_high_school',
    name: '江苏省常熟中学',
    district: '常熟',
    schoolType: '普通高中',
    ownership: '公办',
    boardingType: '待核实',
    intro: '学校基础信息来自常熟市普通高中名录，本版本仅展示基础信息和来源。',
    tags: ['政府名录', '常熟', '普通高中'],
    officialWebsite: 'http://www.jsscszx.com',
    ...sourceFields(SOURCES.changshuList2024, 'government_public', '政府公开资料', '常熟市普通高中名录已核对学校名称和举办者类型；住宿状态需继续复核。')
  }),
  school({
    id: 'changshu_city_high_school',
    name: '常熟市中学',
    district: '常熟',
    schoolType: '普通高中',
    ownership: '公办',
    boardingType: '待核实',
    intro: '学校基础信息来自常熟市普通高中名录，本版本仅展示基础信息和来源。',
    tags: ['政府名录', '常熟', '普通高中'],
    ...sourceFields(SOURCES.changshuList2024, 'government_public', '政府公开资料', '常熟市普通高中名录已核对学校名称和举办者类型；官网和住宿状态需继续复核。')
  }),
  school({
    id: 'changshu_foreign_language_school',
    name: '常熟外国语学校',
    district: '常熟',
    schoolType: '高级中学',
    ownership: '公办',
    boardingType: '待核实',
    intro: '学校基础信息来自常熟市普通高中名录，本版本仅展示基础信息和来源。',
    tags: ['政府名录', '常熟', '高级中学'],
    ...sourceFields(SOURCES.changshuList2024, 'government_public', '政府公开资料', '常熟市普通高中名录已核对学校名称和举办者类型；官网和住宿状态需继续复核。')
  }),
  school({
    id: 'changshu_shanghu_high_school',
    name: '常熟市尚湖高级中学',
    district: '常熟',
    schoolType: '高级中学',
    ownership: '公办',
    boardingType: '待核实',
    intro: '学校基础信息来自常熟市普通高中名录，本版本仅展示基础信息和来源。',
    tags: ['政府名录', '常熟', '高级中学'],
    ...sourceFields(SOURCES.changshuList2024, 'government_public', '政府公开资料', '常熟市普通高中名录已核对学校名称和举办者类型；官网和住宿状态需继续复核。')
  }),
  school({
    id: 'liangfeng_senior_high_school',
    name: '江苏省梁丰高级中学',
    district: '张家港',
    schoolType: '普通高中',
    ownership: '公办',
    boardingType: '待核实',
    intro: '学校基础信息来自学校官网公开页面，本版本仅展示基础信息和来源。',
    tags: ['学校官网', '张家港', '普通高中'],
    officialWebsite: SOURCES.liangfeng.url,
    ...sourceFields(SOURCES.liangfeng, 'official_site', '官网资料', '已核对学校官网首页；住宿、联系方式和地址坐标未进入当前版本。')
  }),
  school({
    id: 'taicang_high_school',
    name: '江苏省太仓高级中学',
    district: '太仓',
    schoolType: '普通高中',
    ownership: '公办',
    boardingType: '待核实',
    intro: '学校基础信息来自苏州市人民政府公开报道，本版本仅展示基础信息和来源。',
    tags: ['政府公开', '太仓', '普通高中'],
    officialWebsite: 'http://stg.tcedu.com.cn',
    ...sourceFields(SOURCES.taicangGov, 'government_public', '政府公开资料', '政府公开报道已核对学校名称；官网、住宿和校区细项需继续复核。')
  }),
  school({
    id: 'taicang_mingde_high_school',
    name: '太仓市明德高级中学',
    district: '太仓',
    schoolType: '普通高中',
    ownership: '待核实',
    boardingType: '待核实',
    intro: '学校名称来自太仓市高级中等学校招生相关公开信息，本版本先保留基础名称和区域。',
    tags: ['政府公开', '太仓', '待复核'],
    officialWebsite: 'https://mdgz.tcjyxx.cn',
    ...sourceFields(SOURCES.taicangGov, 'government_public', '政府公开资料', '学校官网、办学性质和住宿状态需继续复核。')
  }),
  school({
    id: 'demo_green_high_school',
    name: '示例高中 A',
    district: '示例区域',
    schoolType: '示例学校',
    ownership: '待核实',
    boardingType: '待核实',
    intro: '用于体验搜索、筛选、收藏和详情页功能，不对应现实学校。',
    tags: ['示例学校', '功能体验'],
    dataKind: 'demo',
    dataStatus: '示例学校',
    sourceTitle: '本地示例数据',
    sourceUrl: '',
    sourceCheckedAt: checkedAt,
    sourceNote: '示例内容，不对应现实学校。'
  }),
  school({
    id: 'demo_lake_high_school',
    name: '示例高中 B',
    district: '示例区域',
    schoolType: '示例学校',
    ownership: '待核实',
    boardingType: '待核实',
    intro: '用于体验不同筛选状态，不对应现实学校。',
    tags: ['示例学校', '功能体验'],
    dataKind: 'demo',
    dataStatus: '示例学校',
    sourceTitle: '本地示例数据',
    sourceUrl: '',
    sourceCheckedAt: checkedAt,
    sourceNote: '示例内容，不对应现实学校。'
  })
]

module.exports = { schools, SOURCES }
