B=http://localhost:4310; rm -f ck
tok(){ curl -s -b ck -c ck $B$1 | grep -o 'name="_csrf" value="[a-f0-9]*"' | head -1 | sed 's/.*value="//;s/"//'; }
chk(){ if [ "$2" = "$3" ]; then echo "PASS $1 ($3)"; else echo "FAIL $1 expected $2 got $3"; fi; }
T=$(tok /internship)
chk "apply no consent 422" 422 $(curl -s -b ck -c ck -o /dev/null -w %{http_code} --data-urlencode "_csrf=$T" -d "full_name=TEST Student&college=ABC&course_year=BTech 3&whatsapp=9876543210&track=Web Developer" $B/internship)
chk "apply json no consent has consent err" 1 $(curl -s -b ck -H 'Accept: application/json' --data-urlencode "_csrf=$T" -d "full_name=TEST Student&college=ABC&course_year=BTech 3&whatsapp=9876543210&track=Web Developer" $B/internship | grep -c '"consent"')
chk "apply bad track 422" 422 $(curl -s -b ck -o /dev/null -w %{http_code} --data-urlencode "_csrf=$T" -d "full_name=TEST Student&college=ABC&course_year=BTech 3&whatsapp=9876543210&track=Hacking&consent=yes" $B/internship)
chk "apply ok 200" 200 $(curl -s -b ck -o /dev/null -w %{http_code} --data-urlencode "_csrf=$T" -d "full_name=TEST Student&college=ABC College&course_year=BTech 3&whatsapp=9876543210&track=Web Developer&email=test@example.com&city=Faridabad&mode=Live online&source=Instagram&consent=yes&note=TEST" $B/internship)
T=$(tok /admin/login); curl -s -b ck -c ck -o /dev/null --data-urlencode "_csrf=$T" -d "email=goforgedigital@gmail.com&password=TestPassw0rd-123" $B/admin/login
chk "inbox shows app" 1 $(curl -s -b ck $B/admin/applications | grep -c 'TEST Student')
for e in programs instructors stats testimonials credentials; do chk "admin list $e" 200 $(curl -s -b ck -o /dev/null -w %{http_code} $B/admin/$e); chk "admin new $e" 200 $(curl -s -b ck -o /dev/null -w %{http_code} $B/admin/$e/new); done
chk "seed programs 7" 7 $(curl -s -b ck $B/admin/programs | grep -c 'class="item cms-item')
chk "seed stats 4" 4 $(curl -s -b ck $B/admin/stats | grep -c 'class="item cms-item')
chk "no instructors section" 0 $(curl -s $B/internship | grep -c 'id="ins-h"')
chk "no testimonials section" 0 $(curl -s $B/internship | grep -c 'id="tes-h"')
chk "trust stats shown" 1 $(curl -s $B/internship | grep -c 'data-count="98"')
chk "MSME badge" 1 $(curl -s $B/internship | grep -c '<strong>MSME Registered</strong>')
# instructor with upload
T=$(tok /admin/instructors/new); printf '\x89PNG\r\n\x1a\n0000000000000000' > /tmp/x.png; printf 'GIF89a' > /tmp/x.gif
R=$(curl -s -b ck -o /dev/null -w '%{http_code} %{redirect_url}' -F "_csrf=$T" -F "name=Asha Verma" -F "title=Full-stack developer" -F "skills=React, Node" -F "published=1" -F "sort_order=10" -F "photo_url_file=@/tmp/x.png;type=image/png" $B/admin/instructors/new); echo "create instructor: $R"
chk "instructor on public" 1 $(curl -s $B/internship | grep -c 'Asha Verma')
IMG=$(curl -s $B/internship | grep -o 'src="/uploads/[^"]*"' | head -1 | sed 's/src="//;s/"//'); chk "uploaded image served" 200 $(curl -s -o /dev/null -w %{http_code} $B$IMG)
T=$(tok /admin/instructors/new); chk "bad file type 422" 422 $(curl -s -b ck -o /dev/null -w %{http_code} -F "_csrf=$T" -F "name=Bad" -F "photo_url_file=@/tmp/x.gif;type=image/png" $B/admin/instructors/new)
chk "bad url 422" 422 $(curl -s -b ck -o /dev/null -w %{http_code} -F "_csrf=$T" -F "name=Bad" -F "photo_url=javascript:alert(1)" $B/admin/instructors/new)
chk "multipart no csrf 403" 403 $(curl -s -b ck -o /dev/null -w %{http_code} -F "name=Bad" $B/admin/instructors/new)
chk "multipart other path 415" 415 $(curl -s -b ck -o /dev/null -w %{http_code} -F "x=1" $B/contact)
chk "multipart unauth redirects" 303 $(curl -s -o /dev/null -w %{http_code} -F "name=x" $B/admin/instructors/new)
# testimonial
T=$(tok /admin/testimonials/new); curl -s -b ck -o /dev/null -F "_csrf=$T" -F "name=Riya TEST" -F "kind=student" -F "quote=Great live classes and real projects." -F "rating=5" -F "published=1" $B/admin/testimonials/new
chk "testimonial on public" 1 $(curl -s $B/internship | grep -c 'Riya TEST')
# program edit: set fee + batches, then hide
PID=$(curl -s -b ck $B/admin/programs | grep -o '/admin/programs/[0-9]*"' | head -1 | grep -o '[0-9]*')
EDIT=$(curl -s -b ck $B/admin/programs/$PID); NAME=$(echo "$EDIT" | grep -o 'name="name" type="text" value="[^"]*"' | sed 's/.*value="//;s/"//'); echo "editing $PID $NAME"
T=$(tok /admin/programs/$PID)
R=$(curl -s -b ck -o /dev/null -w %{http_code} -F "_csrf=$T" -F "name=$NAME" -F "slug=software-engineering" -F "icon=code" -F "summary=Build features in a real codebase." -F "fee=₹4,999 + GST" -F "batches=2 Nov 2026 | Mon–Fri, 7–9 PM IST | 20 seats" -F "curriculum=Week 1: Foundations | Git, CLI" -F "published=1" -F "sort_order=10" $B/admin/programs/$PID); chk "program save 303" 303 $R
P=$(curl -s $B/internship/programs/software-engineering); chk "admin fee not shown publicly" 0 $(echo "$P" | grep -c '₹4,999'); chk "batch row" 1 $(echo "$P" | grep -c '2 Nov 2026'); chk "jsonld course" 1 $(echo "$P" | grep -c '"@type":"Course"')
chk "no fee text on programme" 0 $(curl -s $B/internship/programs/data-analyst | grep -ci 'contact for fees\|training fee')
chk "no fee text on internship" 0 $(curl -s $B/internship | grep -ci 'contact for fees\|training fee')
# programmes v2
for sl in business-analyst data-science full-stack-web-development; do chk "programme $sl 200" 200 $(curl -s -o /dev/null -w %{http_code} $B/internship/programs/$sl); done
chk "old web-developer slug 301" 301 $(curl -s -o /dev/null -w %{http_code} $B/internship/programs/web-developer)
chk "sitemap has data-science" 1 $(curl -s $B/sitemap.xml | grep -c 'programs/data-science')
chk "apply option Business Analyst" 1 $(curl -s $B/internship | grep -c '<option value="Business Analyst"' | sed 's/[2-9]/1/')
chk "full stack syllabus capstone" 1 $(curl -s $B/internship/programs/full-stack-web-development | grep -c 'Deployed full-stack product' | sed 's/[2-9]/1/')
T=$(tok /admin/programs/new); chk "dup slug 422" 422 $(curl -s -b ck -o /dev/null -w %{http_code} -F "_csrf=$T" -F "name=Dup" -F "slug=software-engineering" -F "icon=code" -F "summary=dup dup dup" $B/admin/programs/new)
T=$(tok /admin/programs/$PID); curl -s -b ck -o /dev/null -F "_csrf=$T" -F "name=$NAME" -F "slug=software-engineering" -F "icon=code" -F "summary=Build features in a real codebase." -F "sort_order=10" $B/admin/programs/$PID
chk "hidden program 404" 404 $(curl -s -o /dev/null -w %{http_code} $B/internship/programs/software-engineering)
chk "hidden program not in select" 0 $(curl -s $B/internship | grep -c "<option value=\"$NAME\"")
# stat edit + delete
SID=$(curl -s -b ck $B/admin/stats | grep -o '/admin/stats/[0-9]*/delete' | head -1 | grep -o '[0-9]\+'); T=$(tok /admin/stats)
chk "delete stat 303" 303 $(curl -s -b ck -o /dev/null -w %{http_code} --data-urlencode "_csrf=$T" $B/admin/stats/$SID/delete)
chk "stats now 3" 3 $(curl -s -b ck $B/admin/stats | grep -c 'class="item cms-item')
chk "bad entity 404" 404 $(curl -s -b ck -o /dev/null -w %{http_code} $B/admin/hackers)
chk "contacts still work" 200 $(curl -s -b ck -o /dev/null -w %{http_code} $B/admin/contacts)
chk "settings still work" 200 $(curl -s -b ck -o /dev/null -w %{http_code} $B/admin/settings)
chk "sitemap programs" 6 $(curl -s $B/sitemap.xml | grep -c '/internship/programs/')
