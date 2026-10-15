package main

import (
	"fmt"
	"example.com/app/store"
)

type Server struct {
	db store.DB
}

func (s *Server) Start() error {
	if s.db == nil { return nil }
	fmt.Println("x")
	return nil
}

func NewServer() *Server { return &Server{} }
