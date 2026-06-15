package main

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
	Parameters []Parameter
	Output     []string
}

type Parameter struct {
	Name string
	Type string
}

type Values struct {
	Value []any
}
