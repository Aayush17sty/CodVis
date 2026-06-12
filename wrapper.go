package main

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"log"
	"os"
)

var Wrap FunctionWrap

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
				for i := range x.Type.Params.List {
					// fmt.Println(x.Type.Params.List[i].Names)
					// // Wrap.Parameters = append(Wrap.Parameters, x.Type.Params.List[i].Names)
					Wrap.ParameterTypes = append(Wrap.ParameterTypes, x.Type.Params.List[i].Type)
				}
			}
		}
		return true
	})
	fmt.Println(Wrap)
}

func MakeMainFunc() {

}
