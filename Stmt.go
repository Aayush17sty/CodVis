package main

import (
	"go/ast"
	"go/token"
	"strconv"
)

func Expression(x ast.Expr) string {
	switch y := x.(type) {
	case *ast.Ident:
		return y.Name
	case *ast.BasicLit:
		return y.Value
	case *ast.BinaryExpr:
		z := BinaryExpression(y)
		return z
	default:
		return "Error"
	}
}

func BinaryExpression(x *ast.BinaryExpr) string {
	res := 0
	y := Expression(x.X)
	z := Expression(x.Y)
	i, err := strconv.Atoi(y)
	if err != nil {
		return "Error, y is not a valid number"
	}
	j, err := strconv.Atoi(z)
	if err != nil {
		return "Error, z is not a valid number"
	}
	if x.Op == token.ADD {
		res = i + j
	}
	if x.Op == token.SUB {
		res = i - j
	}
	s := strconv.Itoa(res)
	return s
}
