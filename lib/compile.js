const { getAst, transform, getDependencies } = require('./parser')
const path = require('path')
const fs = require('fs')
const options = require('../single.config')
class Compiler {
  constructor(options) {
    const { entry, output } = options
    this.entry = entry
    this.output = output
    this.modules = []
    this.dirCache = {}
    this.run()
  }
  // 开启编译
  run() {
    const module = this.buildModule(this.entry)
    this.modules.push(module)
    // 遍历到的当前模块如果有dependencies依赖对象，则将其依赖模块也添加到modules数组中，modules数组会随着遍历进行增多，当前模块及依赖模块都会被遍历到
    this.modules.forEach(({ dependencies }) => {
      if (dependencies) {
        for (const dependency in dependencies) {
          this.modules.push(this.buildModule(dependencies[dependency]))
        }
      }
    })
    // 根据filename生成依赖图关系
    const dependencyGraph = this.modules.reduce(
      (graph, item) => ({
        ...graph,
        [item.filename]: {
          dependencies: item.dependencies,
          code: item.code
        }
      }),
      {}
    )
    // 生成bundle文件
    this.generate(dependencyGraph)
  }
  // 构建模块
  buildModule(filename) {
    const ast = getAst(filename)
    // 递归获取依赖
    const dependencies = getDependencies(ast, filename)
    const code = transform(ast)
    return {
      // 文件路径
      filename,
      // 模块依赖对象
      dependencies,
      // 还原的content
      code
    }
  }
  // 执行code
  generate(graph) {
    // 获取打包输出文件的路径
    const filePath = path.join(this.output.path, this.output.filename)
    // 根据依赖图关系，从入口文件执行，自定义require方法，将babel解析好的code中的require中替换成localRequire，对有require的地方进行递归引入
    // esmodule babel解析好后，导出是一个exports={_esmodule:true}对象，把导出的内容添加到exports中，引入的模块则是该exports对象
    const bundle = `
        (function (graph){
            function require(module){
                function localRequire(relativePath) {
                    return require(graph[module].dependencies[relativePath])
                }
                var exports={};
                (function(require,exports,code){
                    eval(code)
                }(localRequire,exports,graph[module].code))
                return exports
            }
            require(${JSON.stringify(this.entry)})
        }(${JSON.stringify(graph)}))
    `
    this.emitFiles(filePath, bundle)
  }
  //   目录不存在则生成
  makedir(filePath) {
    const dirArr = filePath.split('\\')
    let dir = dirArr[0]
    for (let i = 1; i < dirArr.length; i++) {
      if (!this.dirCache[dir] && !fs.existsSync(dir)) {
        this.dirCache[dir] = true
        fs.mkdirSync(dir)
      }
      dir += '/' + dirArr[i]
    }
  }
  // 输出文件
  emitFiles(filePath, content) {
    if (!fs.existsSync(filePath)) this.makedir(filePath)
    // 写入文件
    fs.writeFileSync(filePath, content, 'utf-8')
  }
}
new Compiler(options)
