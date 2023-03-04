const fs = require('fs')
const path = require('path')
// 解析文件content生成ast
const parser = require('@babel/parser')
// 对ast节点递归遍历收集依赖模块
const traverse = require('@babel/traverse').default
const { transformFromAst } = require('@babel/core')
module.exports = {
  getAst: (path) => {
    // 将文件读取为字符串
    const source = fs.readFileSync(path, 'utf-8')
    // 以模块化方式解析字符串
    return parser.parse(source, { sourceType: 'module' })
  },
  //   依赖模块收集
  getDependencies: (ast, filename) => {
    const dependencies = {}
    traverse(ast, {
      // esmodule 语法
      ImportDeclaration: ({ node }) => {
        // 获取文件目录路径
        const dirname = path.dirname(filename)
        dependencies[node.source.value] = path.join(dirname, node.source.value)
      }
    })
    return dependencies
  },
  transform: (ast) => {
    // 将ast转换成字符串
    const { code } = transformFromAst(ast, null, {
      presets: ['@babel/preset-env']
    })
    return code
  }
}
