package main

import (
	"go/ast"
	"go/token"
	"strconv"
)

func Expression(x ast.Expr, m map[any]any) string {
	switch y := x.(type) {
	case *ast.Ident:
		return y.Name
	case *ast.BasicLit:
		return y.Value
	case *ast.BinaryExpr:
		z := BinaryExpression(y, m)
		return z
	default:
		return "Error"
	}
}

func BinaryExpression(x *ast.BinaryExpr, m map[any]any) string {
	var s int
	res := 0
	y := Expression(x.X, m)
	z := Expression(x.Y, m)
	i, err := strconv.Atoi(y)
	if err != nil {
		// fmt.Printf("Looking for key: '%v' (type: %T)\n", y, y)
		// fmt.Printf("Current map contents: %#v\n", m)
		k := m[y]
		// fmt.Println(k)
		q, ok := k.(string)
		if ok == false {
			return "error in k/y"
		}
		s, err = strconv.Atoi(q)
		if err != nil {
			return "Error in s"
		}
		j, err := strconv.Atoi(z)
		if err != nil {
			return "Error, z is not a valid number"
		}
		if x.Op == token.ADD {
			res = s + j
		}
		if x.Op == token.SUB {
			res = s - j
		}
		if x.Op == token.ASSIGN {
			res = s
		}
		p := strconv.Itoa(res)
		return p
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
	if x.Op == token.ASSIGN {
		res = i
	}
	p := strconv.Itoa(res)
	return p
}

func ForStatement(x *ast.ForStmt, m map[any]any) string {
	return x.Init.(*ast.AssignStmt).Rhs[0].(*ast.BasicLit).Value
}

func AssignmentStatement(x *ast.AssignStmt, m map[any]any) {
	for lhs := range x.Lhs {
		rhs := x.Rhs[lhs]
		v := Expression(rhs, m)
		m[Expression(x.Lhs[lhs], m)] = v
	}
}
