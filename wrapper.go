package main

import (
	"bytes"
	"fmt"
	"go/ast"
	"go/parser"
	"go/printer"
	"go/token"
	"log"
	"os"
)

var Wrap FunctionWrap
var Param Parameter

func typeToString(fset *token.FileSet, expr ast.Expr) string {
	var buf bytes.Buffer
	printer.Fprint(&buf, fset, expr)
	return buf.String()
}

func Wrapper() {
	src, err := os.ReadFile("/home/asty/CodVis/test/example.go")
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, "", src, parser.AllErrors)
	if err != nil {
		log.Fatal(err)
	}
	ast.Inspect(node, func(node ast.Node) bool {
		switch x := node.(type) {
		case *ast.FuncDecl:
			if x.Name.Name != "main" {
				Wrap.Name = x.Name.Name
				for _, param := range x.Type.Params.List {
					Param.Name = param.Names[0].Name
					typeStr := typeToString(fset, param.Type)
					Param.Type = typeStr
					Wrap.Parameters = append(Wrap.Parameters, Param)
				}
				for _, result := range x.Type.Results.List {
					typeStr := typeToString(fset, result.Type)
					Wrap.Output = append(Wrap.Output, typeStr)
				}
			}
		}
		return true
	})
	fmt.Println(Wrap)
}

func MakeMainFunc() {
	fmt.Sprintf(`
		func main() {
    	result := %s(%s)
    	fmt.Println(result)
	}`, Wrap.Name)
}
