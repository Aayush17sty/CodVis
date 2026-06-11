package main

import "go/ast"

type Variable struct {
	Name  string
	Type  string
	Value string
}

type Snapshot struct {
	Line      int
	Variables []Variable
	Callstack []string
}

type Session struct {
	Id        string
	Snapshots []Snapshot
	Current   int
}

type FunctionWrap struct {
	Name       string
	Parameters []*ast.Ident
}
