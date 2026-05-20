package main

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"log"
	"os"
	"strconv"
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
		case *ast.ForStmt:
			v, c := ForStatement(x, m)
			m[x] = v
			j, err := strconv.Atoi(c)
			if err != nil {
				return false
			}
			fmt.Println(j)
			for i := 0; i < j; i++ {
				for stmt := range x.Body.List {
					Statement(x.Body.List[stmt], m)
				}
			}
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
