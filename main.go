package main

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"log"
	"os"
)

func main() {
	src, err := os.ReadFile("example.txt")
	if err != nil {
		fmt.Println("Error:", err)
		return
	}

	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, "", src, parser.AllErrors)
	if err != nil {
		log.Fatal(err)
	}

	m := make(map[any]any)

	ast.Inspect(node, func(node ast.Node) bool {
		switch x := node.(type) {
		case *ast.DeclStmt:
			m[x.Decl] = nil
		case *ast.BinaryExpr:
			m[x.X.(*ast.Ident).Name] = x.Y.(*ast.BasicLit).Value
		case *ast.AssignStmt:
			for lhs := range x.Lhs {
				m[x.Lhs[lhs].(*ast.Ident).Name] = x.Rhs[lhs].(*ast.BasicLit).Value
			}
		case *ast.ForStmt:
			fmt.Printf("%v", x.Init.(*ast.AssignStmt).Lhs[0].(*ast.Ident).Name)
		}
		return true

	})
}
