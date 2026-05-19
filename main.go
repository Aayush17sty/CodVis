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
	var m = make(map[any]any)
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

	ast.Inspect(node, func(node ast.Node) bool {

		switch x := node.(type) {
		// case *ast.DeclStmt:
		// 	m[x.Decl] = nil
		// case *ast.ForStmt:
		// 	m[x.Init.(*ast.AssignStmt).Lhs[0].(*ast.Ident).Name] = x.Init.(*ast.AssignStmt).Rhs[0].(*ast.BasicLit).Value
		// 	for st := range x.Body.List {
		// 		switch s := x.Body.List[st].(type) {
		// 		case *ast.AssignStmt:
		// 			m[s.Lhs[0].(*ast.Ident).Name] = s.Rhs[0].(*ast.BinaryExpr).X.(*ast.Ident).Name + s.Rhs[0].(*ast.BinaryExpr).Y.(*ast.BasicLit).Value
		// 		}
		// 	}oop body logic
		// case *ast.BinaryExpr:
		// 	if x.Op == token.ASSIGN {
		// 		m[x.X.(*ast.Ident).Name] = x.Y.(*ast.BasicLit).Value
		// 	}
		// case *ast.AssignStmt:
		// 	for lhs := range x.Lhs {
		// 		m[x.Lhs[lhs].(*ast.Ident).Name] = x.Rhs[lhs].(*ast.BasicLit).Value
		// 	}
		// }
		// case ast.Expr:
		// 	v := Expression(x, m)
		// 	m[Expression(x, m)] = v
		case *ast.ForStmt:
			v := ForStatement(x, m)
			m[x] = v
		case *ast.AssignStmt:
			AssignmentStatement(x, m)
		}
		return true

	})
	for k, v := range m {
		fmt.Printf("%v, %v", k, v)
		fmt.Println()
	}

}
