Error if `DIM z(size)` isn't called before usage

```
100 PROC x(a(),size,2) TO result:PRINT result:STOP
110 DEFPROC x(inp(),size,y)
120 LOCAL z(),tot
130 DIM z(size)
140 tot=0
150 FOR i=1 TO size:z(i)=inp(i)*y:NEXT i
160 FOR i=1 TO size:tot=tot+z(i):NEXT i
170 ENDPROC = tot
```



---


Test defaults in defproc:

```
100 PROC x(12,,"bob"):STOP
110 DEFPROC x(a=1,b$="alice",c$,d=-5)
120 LOCAL e=3
130 PRINT a,b$,c$,d,e
140 ENDPROC
```

---

## Validation

- Validate missing `ENDIF`
- `IF 0` alone should fail … right?
