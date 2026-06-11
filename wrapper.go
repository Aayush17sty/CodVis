package main

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"log"
	"os"
)

func Wrapper() {
	var Wrap FunctionWrap
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
					Wrap.Parameters = x.Type.Params.List[i].Names
				}
			}
		}
		return true
	})
	fmt.Println(Wrap)
}
