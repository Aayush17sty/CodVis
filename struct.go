package main

type Variable struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Value    string `json:"value"`
	Children []Variable
}

type Snapshot struct {
	Line      int        `json:"line"`
	Variables []Variable `json:"variables"`
	Callstack []string   `json:"callstack"`
}

type Session struct {
	Id        string     `json:"id"`
	Snapshots []Snapshot `json:"snapshots"`
	Current   int        `json:"current"`
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

type application struct {
	config  config
	session *Session
}

type config struct {
	addr string
	db   dbconfig
}

type dbconfig struct {
	dsn string
}
