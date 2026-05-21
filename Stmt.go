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
		k := m[y]
		if k == nil {
			m[y] = z
			k = z
		}
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
		if x.Op == token.LSS {
			res = j
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
	if x.Op == token.LSS {
		res = j
	}
	p := strconv.Itoa(res)
	return p
}

func ForStatement(x *ast.ForStmt, m map[any]any) (string, string) {
	return x.Init.(*ast.AssignStmt).Rhs[0].(*ast.BasicLit).Value, Expression(x.Cond, m)
}

func AssignmentStatement(x *ast.AssignStmt, m map[any]any) {
	for lhs := range x.Lhs {
		rhs := x.Rhs[lhs]
		v := Expression(rhs, m)
		m[Expression(x.Lhs[lhs], m)] = v
	}
}

func Statement(x ast.Stmt, m map[any]any) {
	AssignmentStatement(x.(*ast.AssignStmt), m)
}

func IfStatement(x *ast.IfStmt, m map[any]any) (string, string) {
	return x.Init.(*ast.AssignStmt).Rhs[0].(*ast.BasicLit).Value, Expression(x.Cond, m)
}

func StructStatement(x *ast.StructType, m_struct map[*ast.Ident]ast.Expr) {
	for name := range x.Fields.List {
		for v := range x.Fields.List[name].Names {
			m_struct[x.Fields.List[name].Names[v]] = x.Fields.List[name].Type
		}
	}
}
