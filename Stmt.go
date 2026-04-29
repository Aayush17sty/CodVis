package main

import (
	"go/ast"
)

func Expression(x ast.Expr) any {
	switch y := x.(type) {
	case *ast.Ident:
		return y.Name
	case *ast.BasicLit:
		return y.Value
	case *ast.BinaryExpr:
		return BinaryExpression(y)
	default:
		return "Error"
	}
}

func BinaryExpression(x *ast.BinaryExpr) int {
	return 0
}
