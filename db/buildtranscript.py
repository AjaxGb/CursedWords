import os
from string import Template

chap_i, page_i = 1, 1
filetemp = Template('ch$c/p$p.txt')
with open('transcript.xml', encoding='utf-8', mode='w') as transcript:
	while True:
		print('<chapter num="', chap_i, '">', sep='', file=transcript)
		while os.path.isfile(filetemp.substitute(c=chap_i, p=page_i)):
			with open(filetemp.substitute(c=chap_i, p=page_i), encoding='utf-8') as file:
				if os.stat(file.fileno()).st_size != 0:
					print('<page num="', page_i, '">', sep='', file=transcript)
					for line in file:
						print("\t", line.strip(), sep='', file=transcript)
					print('</page>', file=transcript)
			page_i += 1
		if page_i == 1:
			break
		print('</chapter>', file=transcript)
		chap_i += 1
		page_i = 1