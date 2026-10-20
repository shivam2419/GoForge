B=http://localhost:4310; rm -f ck
tok(){ curl -s -b ck -c ck $B$1 | grep -o 'name="_csrf" value="[a-f0-9]*"' | head -1 | sed 's/.*value="//;s/"//'; }
chk(){ if [ "$2" = "$3" ]; then echo "PASS $1 ($3)"; else echo "FAIL $1 expected $2 got $3"; fi; }
T=$(tok /internship)
chk "apply no consent 422" 422 $(curl -s -b ck -c ck -o /dev/null -w %{http_code} --data-urlencode "_csrf=$T" -d "full_name=TEST Student&college=ABC&course_year=BTech 3&phone=9876543210&track=Web Developer" $B/internship)
chk "apply json no consent has consent err" 1 $(curl -s -b ck -H 'Accept: application/json' --data-urlencode "_csrf=$T" -d "full_name=TEST Student&college=ABC&course_year=BTech 3&phone=9876543210&track=Web Developer" $B/internship | grep -c '"consent"')
chk "apply bad track 422" 422 $(curl -s -b ck -o /dev/null -w %{http_code} --data-urlencode "_csrf=$T" -d "full_name=TEST Student&college=ABC&course_year=BTech 3&phone=9876543210&track=Hacking&consent=yes" $B/internship)
chk "apply ok 200" 200 $(curl -s -b ck -o /dev/null -w %{http_code} --data-urlencode "_csrf=$T" -d "full_name=TEST Student&college=ABC College&course_year=BTech 3&phone=9876543210&track=Web Developer&email=test@example.com&city=Faridabad&mode=Live online&source=Instagram&consent=yes&note=TEST" $B/internship)
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
R=$(curl -s -b ck -o /dev/null -w %{http_code} -F "_csrf=$T" -F "name=$NAME" -F "slug=software-engineering" -F "icon=code" -F "summary=Build features in a real codebase." -F "fee=₹4,999 internal note" -F "batches=18 Jan 2027 | Mon–Fri, 7:30–9 PM IST | 25 seats" -F "curriculum=Week 1: Foundations | Git, CLI" -F "published=1" -F "sort_order=10" $B/admin/programs/$PID); chk "program save 303" 303 $R
P=$(curl -s $B/internship/programs/software-engineering); chk "admin fee not shown publicly" 0 $(echo "$P" | grep -c '₹4,999'); chk "admin batch row in table" 1 $(echo "$P" | grep -c '<td>18 Jan 2027</td>'); chk "jsonld course" 1 $(echo "$P" | grep -c '"@type":"Course"')
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
# programme card Apply now goes to the programme page; programme page has preselected form
chk "card apply links to programme page" 1 $(curl -s $B/internship | grep -c 'btn-apply" href="/internship/programs/data-science"')
PG=$(curl -s $B/internship/programs/data-science)
chk "programme page apply button scrolls" 1 $(echo "$PG" | grep -c 'href="#apply">Apply now' | sed 's/[2-9]/1/')
chk "programme page apply + counselling forms preselected" 2 $(echo "$PG" | grep -c '<option value="Data Science" selected')
chk "programme page no fees" 0 $(echo "$PG" | grep -ci 'contact for fees\|training fee')
# about: journey, benefits, achievements; faq accordion
AB=$(curl -s $B/about)
chk "about journey 6 steps" 6 $(echo "$AB" | grep -o 'class="jstep jstep-' | wc -l)
chk "about benefits row" 1 $(echo "$AB" | grep -c 'class="benefit-row"')
chk "about certificate card" 1 $(echo "$AB" | grep -c 'udyam-certificate-sm.jpg' | sed 's/[2-9]/1/')
chk "certificate image served" 200 $(curl -s -o /dev/null -w %{http_code} $B/img/certificates/udyam-certificate.jpg)
FQ=$(curl -s $B/faq)
chk "faq accordion" 1 $(echo "$FQ" | grep -c 'class="faq-acc"' | sed 's/[2-9]/1/')
chk "faq register question" 1 $(echo "$FQ" | grep -c 'How can I register for an internship?' | sed 's/[2-9]/1/')
chk "faq no whatsapp" 0 $(echo "$FQ" | grep -ci 'whatsapp')
chk "desktop nav home active" 1 $(curl -s $B/ | grep -c "<li><a href=\"/\" aria-current=\"page\">Home</a></li>")
# zero whatsapp anywhere in public output
WA=0; for u in / /services /services/custom-software-development /services/crm-development /services/erp-development /services/ai-automation /services/website-development /services/digital-marketing /services/real-estate-crm /services/school-management-software /work /internship /colleges /schools /verify /about /contact /faq /privacy /terms /refund /internship/overview /internship/programs/data-science /sitemap.xml /css/site.css /js/site.js; do n=$(curl -s $B$u | grep -ci whatsapp); WA=$((WA+n)); done
chk "zero whatsapp in public output" 0 $WA
# company LinkedIn
LI='https://www.linkedin.com/company/143989208'
chk "footer follow linkedin" 1 $(curl -s $B/faq | grep -c "href=\"$LI\" target=\"_blank\" rel=\"noopener\" aria-label=\"Goforge Digital on LinkedIn\" title=\"LinkedIn\"")
chk "social mail icon (footer+contact)" 2 $(curl -s $B/contact | grep -c "aria-label=\"Email us\" title=\"Email us\"")
chk "contact linkedin detail" 1 $(curl -s $B/contact | grep -c 'Follow us on LinkedIn</a></span>')
chk "about linkedin button" 1 $(curl -s $B/about | grep -c 'Follow Goforge Digital on LinkedIn')
chk "jsonld sameAs company" 1 $(curl -s $B/ | grep -c "\"sameAs\":\[\"https://www.instagram.com/goforgedigital/\",\"$LI\"\]")
# schools page
chk "schools 200" 200 $(curl -s -o /dev/null -w %{http_code} $B/schools)
chk "schools in Careers nav (desktop+mobile)" 2 $(curl -s $B/ | grep -c 'href="/schools">Schools</a>')
chk "schools in footer" 1 $(curl -s $B/ | grep -c 'href="/schools">For schools</a>')
chk "schools in sitemap" 1 $(curl -s $B/sitemap.xml | grep -c '/schools</loc>')
chk "schools breadcrumb" 1 $(curl -s $B/schools | grep -c '"BreadcrumbList"')
chk "schools stats" 3 $(curl -s $B/schools | grep -cE '<dd>(Students trained|Partner schools|NEP 2020 aligned)</dd>')
chk "schools no fee figures" 0 $(curl -s $B/schools | grep -c '₹')
ST=$(curl -s -c ck2 $B/schools | grep -o 'name="_csrf" value="[^"]*"' | head -1 | sed 's/.*value="//;s/"//')
chk "school bad interest 422" 422 $(curl -s -b ck2 -o /dev/null -w %{http_code} --data-urlencode "_csrf=$ST" -d "school=Test Public School&name=TEST Principal&phone=9876543210&interest=Other" $B/schools)
chk "school ok 200" 200 $(curl -s -b ck2 -o /dev/null -w %{http_code} --data-urlencode "_csrf=$ST" -d "school=Test Public School&name=TEST Principal&role=Principal&phone=9876543210&email=p@example.com&city=Faridabad&size=300–800 students&interest=Both" $B/schools)
chk "school in schools inbox" 1 $(curl -s -b ck $B/admin/schools | grep -c 'Test Public School')
chk "school not in enquiries" 0 $(curl -s -b ck $B/admin/contacts | grep -c 'Test Public School')
rm -f ck2
# student trust: counselling calls, why-trust band, samples, hidden-until-filled sections
CT=$(curl -s -c ck3 $B/counselling | grep -o 'name="_csrf" value="[^"]*"' | head -1 | sed 's/.*value="//;s/"//')
chk "counselling ok 200" 200 $(curl -s -b ck3 -o /dev/null -w %{http_code} --data-urlencode "_csrf=$CT" -d "name=TEST Counsel&phone=9876543210&program=Data Analyst&time=Any time" $B/counselling)
chk "counselling bad time 422" 422 $(curl -s -b ck3 -o /dev/null -w %{http_code} --data-urlencode "_csrf=$CT" -d "name=TEST Counsel&phone=9876543210&time=Midnight" $B/counselling)
chk "counselling in its inbox" 1 $(curl -s -b ck $B/admin/counselling | grep -c 'TEST Counsel')
chk "counselling not in enquiries" 0 $(curl -s -b ck $B/admin/contacts | grep -c 'TEST Counsel')
IN=$(curl -s $B/internship)
chk "internship counselling button (hero + final band)" 2 $(echo "$IN" | grep -c 'Book a free counselling call</a>')
chk "internship why-trust band" 1 $(echo "$IN" | grep -c 'id="why-h"')
chk "internship sample certificate" 1 $(echo "$IN" | grep -c 'sample-certificate.webp" alt')
chk "verify sample certificate" 1 $(curl -s $B/verify | grep -c 'sample-certificate.webp" alt')
chk "no unprovable recognition claim" 0 $(echo "$IN" | grep -ci 'recognised by industry')
chk "student work hidden when empty" 0 $(echo "$IN" | grep -c 'id="work-h"')
chk "gallery hidden when empty" 0 $(echo "$IN" | grep -c 'id="gal-h"')
chk "parents faq" 1 $(echo "$IN" | grep -c 'For parents</h3>')
chk "home student band" 1 $(curl -s $B/ | grep -c 'class="student-band"')
chk "careers & training nav" 1 $(curl -s $B/ | grep -c 'data-nav-group>Careers &amp; Training</a>')
for e in projects gallery samples; do chk "admin new $e" 200 $(curl -s -b ck -o /dev/null -w %{http_code} $B/admin/$e/new); done
rm -f ck3
# November batch: prices, seat cap, seats filled, referral, webinar, guide
chk "internship prices (card + final band)" 2 $(echo "$IN" | grep -c '₹1,499</strong>')
chk "internship 6-month price (card + compare)" 2 $(echo "$IN" | grep -c '₹1,999</strong>')
chk "no early-bird" 0 $(echo "$IN" | grep -ci 'early-bird\|early bird\|₹1,299\|₹1,799')
chk "no GST" 0 $(echo "$IN" | grep -c 'GST')
chk "seat cap shown (0 filled)" 2 $(echo "$IN" | grep -c 'Only 25 seats</span>')
chk "no count-up at 0" 0 $(echo "$IN" | grep -c 'data-countup')
chk "no filling-fast at 0" 0 $(echo "$IN" | grep -c 'class="bc3-tag"')
chk "registration closes (key chip + timeline)" 2 $(echo "$IN" | grep -c 'Registration closes</strong>')
chk "old tracks gone" 0 $(echo "$IN" | grep -ci '6-Week\|1-Month\|4-Month\|18 weeks')
T=$(tok /admin/settings); SET=$(curl -s -b ck $B/admin/settings)
v(){ echo "$SET" | grep -o "name=\"$1\" type=\"[a-z]*\" value=\"[^\"]*\"" | sed 's/.*value="//;s/"$//'; }
R=$(curl -s -b ck -o /dev/null -w %{http_code} --data-urlencode "_csrf=$T" --data-urlencode "phone1=$(v phone1)" --data-urlencode "phone2=$(v phone2)" --data-urlencode "email=$(v email)" --data-urlencode "linkedin_company=$(v linkedin_company)" \
  --data-urlencode "blurb1=Web apps, portals and internal tools built around your workflow." --data-urlencode "blurb2=CRM and ERP systems that bring leads and billing together." --data-urlencode "blurb3=AI-powered workflows that send alerts and follow-ups for you." --data-urlencode "blurb4=Local SEO, Google Business Profile and targeted ads for you." \
  -d "intern_training=6 weeks&intern_work=12 weeks&intern_fee=Contact for fees&seats_weekday=7&seats_weekend=25" $B/admin/settings); chk "settings seats save 303" 303 $R
IN=$(curl -s $B/internship)
chk "weekday 7 of 25 filled" 1 $(echo "$IN" | grep -c 'aria-label="7 of 25 seats filled"')
chk "weekday 18 seats left" 1 $(echo "$IN" | grep -c '>18 seats left</span>')
chk "weekend batch full chip" 1 $(echo "$IN" | grep -c '>Batch full</span>')
chk "no seat grid or ring (v3)" 0 $(echo "$IN" | grep -c 'seat-grid\|bc2-ring')
chk "no filling-fast below 60% or when full" 0 $(echo "$IN" | grep -c 'class="bc3-tag"')
chk "count-up uses admin number" 1 $(echo "$IN" | grep -c 'data-countup="7"')
T=$(tok /admin/settings); chk "seats over cap rejected" 422 $(curl -s -b ck -o /dev/null -w %{http_code} --data-urlencode "_csrf=$T" -d "phone1=+91 84488 52971&phone2=+91 89580 39354&email=info@goforgedigital.com&seats_weekday=26&seats_weekend=0&intern_training=6 weeks&intern_work=12 weeks&intern_fee=x" $B/admin/settings)
CT=$(curl -s -c ck4 $B/counselling | grep -o 'name="_csrf" value="[^"]*"' | head -1 | sed 's/.*value="//;s/"//')
chk "counselling with referral + webinar 200" 200 $(curl -s -b ck4 -H "X-Forwarded-For: 10.9.0.$((RANDOM%250+1))" -o /dev/null -w %{http_code} --data-urlencode "_csrf=$CT" --data-urlencode "interest=Free webinar (Sat 24 Oct, 11 AM)" --data-urlencode "batch=Not sure yet" --data-urlencode "track=3-Month Programme (1 month training + 2 months internship)" -d "name=TEST Referral&phone=9876543210&referred_by=Aman 9811111111" $B/counselling)
chk "referral shown in counselling inbox" 1 $(curl -s -b ck $B/admin/counselling | grep -c 'Aman 9811111111')
chk "old track rejected" 422 $(curl -s -b ck4 -H "X-Forwarded-For: 10.9.0.$((RANDOM%250+1))" -o /dev/null -w %{http_code} --data-urlencode "_csrf=$CT" --data-urlencode "track=6-Week Industrial Training + Internship (6 weeks)" -d "name=TEST Old&phone=9876543210" $B/counselling)
chk "apply with referral 200" 200 $(curl -s -b ck4 -H "X-Forwarded-For: 10.9.0.$((RANDOM%250+1))" -o /dev/null -w %{http_code} --data-urlencode "_csrf=$CT" -d "full_name=TEST RefApp&college=ABC College&course_year=BTech 3&phone=9876543210&track=Data Analyst&consent=yes&referred_by=Neha" $B/internship)
chk "referral shown in applications inbox" 1 $(curl -s -b ck $B/admin/applications | grep -c '<dd>Neha</dd>')
chk "guide no consent 422" 422 $(curl -s -b ck4 -H "X-Forwarded-For: 10.9.0.$((RANDOM%250+1))" -o /dev/null -w %{http_code} -H 'Accept: application/json' --data-urlencode "_csrf=$CT" -d "name=TEST Guide&phone=9876543210" $B/guide)
GJ=$(curl -s -b ck4 -H "X-Forwarded-For: 10.9.0.$((RANDOM%250+1))" -H 'Accept: application/json' --data-urlencode "_csrf=$CT" -d "name=TEST Guide&phone=9876543210&consent=yes" $B/guide)
GU=$(echo "$GJ" | grep -o '/internship/guide.pdf?t=[a-z0-9.]*' | head -1); chk "guide link returned" 1 $([ -n "$GU" ] && echo 1 || echo 0)
chk "guide pdf with token" 200 $(curl -s -o /dev/null -w %{http_code} "$B$GU")
chk "guide pdf type" 1 $(curl -s -D - -o /dev/null "$B$GU" | grep -ci 'content-type: application/pdf')
chk "guide pdf without token redirects" 303 $(curl -s -o /dev/null -w %{http_code} "$B/internship/guide.pdf?t=abc")
chk "guide lead in its inbox" 1 $(curl -s -b ck $B/admin/guides | grep -c 'TEST Guide')
chk "guide lead not in enquiries" 0 $(curl -s -b ck $B/admin/contacts | grep -c 'TEST Guide')
PJ=$(curl -s $B/internship/programs/data-analyst); chk "course offers INR" 2 $(echo "$PJ" | grep -o '"priceCurrency":"INR"' | wc -l | tr -d ' ')
chk "course P3M" 1 $(echo "$PJ" | grep -c '"courseWorkload":"P3M"')
rm -f ck4

# ---- polish: programme nav, tools, fit, compare, kit, timeline, refund note, final band, OG, 404 ----
PG=$(curl -s $B/internship/programs/data-analyst)
chk "programme page nav" 1 $(echo "$PG" | grep -c 'data-page-nav')
chk "tool logos" 1 $(echo "$PG" | grep -c 'class="tool-grid"')
chk "tool trademark note" 1 $(echo "$PG" | grep -c 'shown only to name the tools taught')
chk "faq honest no-guarantee" 1 $(echo "$PG" | grep -c 'We do not promise jobs or placements')
chk "kit section" 1 $(echo "$PG" | grep -c 'id="kit"')
chk "compare table" 1 $(echo "$PG" | grep -c 'class="cmp"')
chk "timeline 8 steps" 8 $(echo "$PG" | grep -c 'class="tl-item')
chk "refund note" 1 $(echo "$PG" | grep -c 'Full refund if you cancel before your first live class')
chk "final band" 1 $(echo "$PG" | grep -c 'cta-band-students')
chk "programme og + twitter image" 2 $(echo "$PG" | grep -c 'og/program-data-analyst.png')
chk "og file served" 200 $(curl -s -o /dev/null -w %{http_code} $B/img/og/program-data-analyst.png)
chk "no GST on programme" 0 $(echo "$PG" | grep -c 'GST')
chk "404 student path" 1 $(curl -s $B/no-such-page | grep -c 'class="err-paths"')

# ---- seats v2: Filling fast only at >= 60% real fill ----
T=$(tok /admin/settings); SET=$(curl -s -b ck $B/admin/settings)
R=$(curl -s -b ck -o /dev/null -w %{http_code} --data-urlencode "_csrf=$T" --data-urlencode "phone1=$(v phone1)" --data-urlencode "phone2=$(v phone2)" --data-urlencode "email=$(v email)" --data-urlencode "linkedin_company=$(v linkedin_company)" \
  --data-urlencode "blurb1=Web apps, portals and internal tools built around your workflow." --data-urlencode "blurb2=CRM and ERP systems that bring leads and billing together." --data-urlencode "blurb3=AI-powered workflows that send alerts and follow-ups for you." --data-urlencode "blurb4=Local SEO, Google Business Profile and targeted ads for you." \
  -d "intern_training=6 weeks&intern_work=12 weeks&intern_fee=Contact for fees&seats_weekday=10&seats_weekend=17" $B/admin/settings); chk "settings 10/17 save 303" 303 $R
IN=$(curl -s $B/internship)
chk "filling fast only on weekend (17/25 = 68%)" 1 $(echo "$IN" | grep -c 'class="bc3-tag"')
chk "weekday 15 left" 1 $(echo "$IN" | grep -c '>15 seats left</span>')
chk "weekend 8 left" 1 $(echo "$IN" | grep -c '>8 seats left</span>')
chk "enrolling now on both" 2 $(echo "$IN" | grep -c 'Enrolling now')
chk "seat-mini on strip + sticky bar" 2 $(echo "$IN" | grep -c 'Seats left: weekday <strong>15</strong>')
chk "reserve your seat CTA" 2 $(echo "$IN" | grep -c '>Reserve your seat')

# ---- free webinar: bar, cards, /webinar page, Event JSON-LD, registrant-only Meet link ----
H=$(curl -s $B/); IN=$(curl -s $B/internship); WB=$(curl -s $B/webinar)
chk "announcement bar on home" 1 $(echo "$H" | grep -c 'data-ann="webinar-2026-10-24"')
chk "announcement bar links to /webinar" 1 $(echo "$H" | grep -c 'class="ann-link" href="/webinar"')
chk "no bar on /webinar" 0 $(echo "$WB" | grep -c 'data-ann=')
chk "no bar on /counselling" 0 $(curl -s $B/counselling | grep -c 'data-ann=')
chk "bar on about" 1 $(curl -s $B/about | grep -c 'data-ann=')
chk "webinar card on home" 1 $(echo "$H" | grep -c 'class="wbc"')
chk "webinar card on internship" 1 $(echo "$IN" | grep -c 'class="wbc"')
chk "card poster webp + lazy" 1 $(echo "$H" | grep -c 'webinar-poster-360.webp')
chk "Event JSON-LD home" 1 $(echo "$H" | grep -c '"@type":"Event"')
chk "Event JSON-LD internship" 1 $(echo "$IN" | grep -c '"@type":"Event"')
chk "Event JSON-LD webinar page" 1 $(echo "$WB" | grep -c '"eventAttendanceMode":"https://schema.org/OnlineEventAttendanceMode"')
chk "Event free" 1 $(echo "$WB" | grep -c '"isAccessibleForFree":true')
chk "webinar form preselects interest" 1 $(echo "$WB" | grep -c 'name="interest" value="Free webinar (Sat 24 Oct, 11 AM)"')
chk "counselling ?interest=webinar preselects" 1 $(curl -s "$B/counselling?interest=webinar" | grep -c 'selected>Free webinar')
chk "webinar page not recorded promise" 1 $(echo "$WB" | grep -c 'Please join live. We cannot promise a recording')
for p in / /internship /webinar /counselling /about /faq; do chk "no Meet link in public $p" 0 $(curl -s $B$p | grep -c 'meet.google.com'); done
chk "webinar in sitemap" 1 $(curl -s $B/sitemap.xml | grep -c '/webinar</loc>')
chk "no GST on webinar" 0 $(echo "$WB" | grep -c 'GST')
T=$(tok /webinar)
chk "webinar sign-up 422 without phone renders webinar" 1 $(curl -s -b ck -H 'X-Forwarded-For: 10.7.0.1' --data-urlencode "_csrf=$T" --data-urlencode "name=Web TEST" --data-urlencode "interest=Free webinar (Sat 24 Oct, 11 AM)" -d "from=webinar" $B/counselling | grep -c 'Save your free seat')
R=$(curl -s -b ck -H 'Accept: application/json' -H 'X-Forwarded-For: 10.7.0.2' --data-urlencode "_csrf=$T" --data-urlencode "name=Web TEST" -d "phone=9876543210" --data-urlencode "interest=Free webinar (Sat 24 Oct, 11 AM)" -d "from=webinar" $B/counselling)
chk "registered title" 1 $(echo "$R" | grep -c "You're registered")
chk "Meet link only after sign-up" 1 $(echo "$R" | grep -c 'meet.google.com/dhk-pchn-zqx')
chk "Google Calendar link with UTC dates" 1 $(echo "$R" | grep -c 'dates=20261024T053000Z%2F20261024T063000Z')
ICS=$(echo "$R" | grep -o '/webinar.ics?t=[a-z0-9.]*' | head -1)
chk "ics served" 1 $(curl -s "$B$ICS" | grep -c 'DTSTART:20261024T053000Z')
chk "ics bad token redirects" 303 $(curl -s -o /dev/null -w %{http_code} "$B/webinar.ics?t=nope")
chk "no-JS thank-you shows Meet link" 1 $(curl -s -b ck -H 'X-Forwarded-For: 10.7.0.3' --data-urlencode "_csrf=$T" --data-urlencode "name=Web TEST" -d "phone=9876543210" --data-urlencode "interest=Free webinar (Sat 24 Oct, 11 AM)" $B/counselling | grep -c 'class="wb-meet-link"')
chk "plain counselling has no Meet link" 0 $(curl -s -b ck -H 'Accept: application/json' -H 'X-Forwarded-For: 10.7.0.4' --data-urlencode "_csrf=$T" --data-urlencode "name=Call TEST" -d "phone=9876543210" $B/counselling | grep -c 'meet.google.com')
