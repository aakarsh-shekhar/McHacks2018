import json
import sys
if len(sys.argv) != 4:
	print("usage: python3 txttojson.py <infile.txt> <title> <outfile.json>")
	exit(0);
with open(sys.argv[1], "r") as infile:
	indata = infile.read()
dat = {"Records": [{
	"text": indata,
	"title": sys.argv[2],
	"id": sys.argv[2]
}]}

with open(sys.argv[3], "w", encoding="utf-8") as outfile:
	json.dump(dat, outfile)
