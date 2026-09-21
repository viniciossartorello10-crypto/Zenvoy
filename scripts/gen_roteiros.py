# -*- coding: utf-8 -*-
"""Generate static SEO landing pages at /roteiro/<slug>/index.html.
Each page: destination hero (gradient + progressive Unsplash photo), a real
3-day sample itinerary (manhã/tarde/noite), and a CTA that deep-links into the
app with ?dest=<City> to pre-fill the wizard. Run: python3 scripts/gen_roteiros.py
"""
import io, os, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE_URL = "https://zenvoytravel.netlify.app"

DESTS = [
 dict(slug="paris", name="Paris", country="França", emoji="🇫🇷", g1="#2b2140", g2="#6d4c7d", intro="A Cidade Luz combina arte, gastronomia e romance. Este roteiro de 3 dias cobre os marcos clássicos e cantos charmosos de Paris.", days=[
   ("Clássicos de Paris","Torre Eiffel e Campo de Marte ao amanhecer","Museu do Louvre e Jardim das Tulherias","Jantar em bistrô no bairro do Marais"),
   ("Arte e boemia","Basílica de Sacré-Cœur em Montmartre","Museu d'Orsay e passeio pelo Sena","Cruzeiro noturno pelo Rio Sena"),
   ("Realeza e compras","Palácio de Versalhes (bate-volta)","Champs-Élysées e Arco do Triunfo","Vinho no Quartier Latin")]),
 dict(slug="lisboa", name="Lisboa", country="Portugal", emoji="🇵🇹", g1="#1f3a4d", g2="#3f8ea3", intro="Colinas, azulejos e fado. Lisboa é acolhedora e cheia de história — ideal para brasileiros pela língua e pela comida.", days=[
   ("Alfama e centro","Castelo de São Jorge e miradouros","Sé de Lisboa e ruas de Alfama","Casa de fado em Alfama"),
   ("Belém histórica","Torre de Belém e Mosteiro dos Jerónimos","Pastéis de Belém e MAAT","Jantar no Cais do Sodré"),
   ("Sintra encantada","Palácio da Pena em Sintra","Quinta da Regaleira","Petiscos no Bairro Alto")]),
 dict(slug="roma", name="Roma", country="Itália", emoji="🇮🇹", g1="#3a2a1e", g2="#8a6b45", intro="A Cidade Eterna reúne milênios de história a cada esquina. Três dias para viver o melhor de Roma antiga e barroca.", days=[
   ("Roma antiga","Coliseu e Fórum Romano","Monte Palatino e Panteão","Jantar em Trastevere"),
   ("Vaticano","Museus do Vaticano e Capela Sistina","Basílica de São Pedro","Gelato perto da Piazza Navona"),
   ("Barroco romano","Fontana di Trevi e Escadaria Espanhola","Villa Borghese","Cantina tradicional em Monti")]),
 dict(slug="nova-york", name="Nova York", country="EUA", emoji="🇺🇸", g1="#1c2333", g2="#4a5a7a", intro="A cidade que nunca dorme. De arranha-céus a parques e museus de classe mundial, Nova York cabe muito em 3 dias.", days=[
   ("Ícones de Manhattan","Times Square e Top of the Rock","Central Park e Museu de História Natural","Broadway à noite"),
   ("Downtown","Estátua da Liberdade e Ellis Island","Memorial do 11/9 e One World","Jantar no Greenwich Village"),
   ("Cultura e vistas","MoMA e Quinta Avenida","High Line e Chelsea Market","Vista da Ponte do Brooklyn")]),
 dict(slug="orlando", name="Orlando", country="EUA", emoji="🎢", g1="#1e2f45", g2="#3d76a8", intro="A capital mundial dos parques temáticos. Diversão para todas as idades — perfeito para famílias brasileiras.", days=[
   ("Magic Kingdom","Castelo da Cinderela e atrações clássicas","Parada e Fantasyland","Fogos noturnos no Magic Kingdom"),
   ("Universal","The Wizarding World of Harry Potter","Islands of Adventure","CityWalk à noite"),
   ("Compras e relax","Premium Outlets","EPCOT ou Disney Springs","Jantar temático em Disney Springs")]),
 dict(slug="cancun", name="Cancún", country="México", emoji="🏖️", g1="#0f4a52", g2="#2bb3a3", intro="Praias caribenhas de água azul-turquesa, ruínas maias e vida noturna animada. Cancún é sol o ano inteiro.", days=[
   ("Praia e zona hoteleira","Praia Delfines e mar do Caribe","Catamarã em Isla Mujeres","Balada na Zona Hoteleira"),
   ("Cultura maia","Ruínas de Chichén Itzá (bate-volta)","Cenote sagrado para nadar","Jantar mexicano em Puerto Juárez"),
   ("Natureza","Parque Xcaret ou Xel-Há","Snorkel em recifes","Pôr do sol em Playa Norte")]),
 dict(slug="buenos-aires", name="Buenos Aires", country="Argentina", emoji="🇦🇷", g1="#243447", g2="#5a86b3", intro="A Paris da América do Sul: tango, parrillas e arquitetura elegante — pertinho do Brasil e cheia de charme.", days=[
   ("Centro histórico","Plaza de Mayo e Casa Rosada","Caminito em La Boca","Show de tango em San Telmo"),
   ("Elegância portenha","Recoleta e seu cemitério","Palermo e seus parques","Parrilla em Palermo Soho"),
   ("Compras e café","Avenida Santa Fe e Florida","Puerto Madero à beira d'água","Café histórico no Tortoni")]),
 dict(slug="santiago", name="Santiago", country="Chile", emoji="🏔️", g1="#2a2f3a", g2="#6b7a8f", intro="Cordilheira dos Andes de cenário, vinhos premiados e neve no inverno. Santiago é destino para todas as estações.", days=[
   ("Centro de Santiago","Plaza de Armas e Catedral","Cerro San Cristóbal (vista da cidade)","Jantar no Bellavista"),
   ("Vinhos e vales","Vinícola no Valle del Maipo","Degustação de vinhos","Barrio Lastarria à noite"),
   ("Neve ou litoral","Valle Nevado ou Cajón del Maipo","Valparaíso e Viña del Mar","Frutos do mar em Valparaíso")]),
 dict(slug="bali", name="Bali", country="Indonésia", emoji="🌴", g1="#14432e", g2="#3fa06a", intro="Templos milenares, arrozais em terraços e praias de surfe. Bali é espiritual, exótica e inesquecível.", days=[
   ("Ubud cultural","Floresta dos Macacos e templos","Terraços de arroz de Tegalalang","Dança tradicional balinesa"),
   ("Templos e água","Templo Tanah Lot","Cachoeiras de Tegenungan","Jantar à beira-mar em Jimbaran"),
   ("Praia e surfe","Praia de Seminyak ou Kuta","Aula de surfe","Beach club ao pôr do sol")]),
 dict(slug="dubai", name="Dubai", country="Emirados Árabes", emoji="🕌", g1="#3a2e1c", g2="#b08b3e", intro="Do deserto ao arranha-céu mais alto do mundo. Dubai mistura luxo, tecnologia e cultura árabe.", days=[
   ("Dubai moderna","Burj Khalifa (mirante) e Dubai Mall","Fonte dançante do Dubai","Jantar com vista para o Burj"),
   ("Deserto","Safári de dunas em 4x4","Passeio de camelo","Jantar beduíno com show"),
   ("Tradição e praia","Souks de ouro e especiarias em Deira","Praia de Jumeirah e Burj Al Arab","Cruzeiro de dhow na Marina")]),
 dict(slug="toquio", name="Tóquio", country="Japão", emoji="🗾", g1="#2b1f33", g2="#7d4c86", intro="Tradição e futuro lado a lado. Tóquio encanta com templos, tecnologia, gastronomia e bairros vibrantes.", days=[
   ("Tóquio tradicional","Templo Senso-ji em Asakusa","Palácio Imperial e jardins","Izakaya em Shinjuku"),
   ("Tóquio moderna","Cruzamento de Shibuya","Harajuku e Meiji Jingu","Vista noturna de Shinjuku"),
   ("Cultura e sabor","Mercado externo de Tsukiji","Akihabara (eletrônicos e anime)","Sushi em Ginza")]),
 dict(slug="londres", name="Londres", country="Reino Unido", emoji="🇬🇧", g1="#22262f", g2="#556074", intro="História, realeza e cultura pop. Londres é uma das capitais mais completas do mundo para visitar.", days=[
   ("Marcos reais","Big Ben e Parlamento","Abadia de Westminster e Buckingham","Musical no West End"),
   ("Museus e torre","Torre de Londres e Tower Bridge","British Museum (grátis)","Jantar em Covent Garden"),
   ("Vistas e parques","London Eye e South Bank","Hyde Park e Kensington","Pub tradicional em Soho")]),
 dict(slug="barcelona", name="Barcelona", country="Espanha", emoji="🇪🇸", g1="#3a241e", g2="#a85b3e", intro="A cidade de Gaudí: arquitetura surreal, praias urbanas e tapas por toda parte. Barcelona é pura energia.", days=[
   ("Gaudí","Sagrada Família","Parque Güell","Tapas em El Born"),
   ("Gótico e mar","Bairro Gótico e La Rambla","Praia da Barceloneta","Jantar com frutos do mar"),
   ("Arte e vistas","Casa Batlló e La Pedrera","Montjuïc e fonte mágica","Flamenco à noite")]),
 dict(slug="rio-de-janeiro", name="Rio de Janeiro", country="Brasil", emoji="🇧🇷", g1="#123a2e", g2="#2f9c78", intro="A Cidade Maravilhosa: praias icônicas, morros com vistas de tirar o fôlego e samba no pé.", days=[
   ("Cartões-postais","Cristo Redentor no Corcovado","Praia de Copacabana","Show de samba na Lapa"),
   ("Pão de Açúcar","Bondinho do Pão de Açúcar","Praia de Ipanema e Arpoador","Pôr do sol no Arpoador"),
   ("Natureza e cultura","Jardim Botânico e Floresta da Tijuca","Santa Teresa e Escadaria Selarón","Boteco no Leblon")]),
 dict(slug="fernando-de-noronha", name="Fernando de Noronha", country="Brasil", emoji="🐬", g1="#0f4a55", g2="#28b0b5", intro="O paraíso ecológico do Brasil: praias entre as mais bonitas do mundo, golfinhos e mergulho espetacular.", days=[
   ("Praias icônicas","Baía do Sancho (eleita a mais bonita)","Baía dos Porcos","Pôr do sol no Forte dos Remédios"),
   ("Vida marinha","Mergulho ou snorkel na Baía","Projeto Tamar e golfinhos","Jantar na Vila dos Remédios"),
   ("Trilhas","Trilha do Atalaia (piscina natural)","Praia do Leão","Observação de estrelas")]),
 dict(slug="gramado", name="Gramado", country="Brasil", emoji="🍫", g1="#2a1f2e", g2="#7a5069", intro="A Serra Gaúcha com clima europeu, chocolate artesanal e o famoso Natal Luz. Charme o ano inteiro.", days=[
   ("Centro charmoso","Rua Coberta e Lago Negro","Mini Mundo","Fondue à noite"),
   ("Vinhos e vale","Vale dos Vinhedos (Bento Gonçalves)","Degustação de vinhos","Jantar típico colonial"),
   ("Passeios","Snowland (neve indoor)","Le Jardin parque de lavandas","Chocolate quente na Rua Coberta")]),
 dict(slug="foz-do-iguacu", name="Foz do Iguaçu", country="Brasil", emoji="💦", g1="#123a34", g2="#2f9c8a", intro="As Cataratas do Iguaçu, uma das 7 maravilhas naturais, além da Itaipu e a tríplice fronteira.", days=[
   ("Cataratas (lado BR)","Parque Nacional do Iguaçu e as Cataratas","Parque das Aves","Jantar com vista"),
   ("Itaipu e fronteira","Usina de Itaipu Binacional","Marco das Três Fronteiras","Pôr do sol na fronteira"),
   ("Lado argentino","Garganta do Diabo (Puerto Iguazú)","Trilhas das passarelas","Compras no Paraguai")]),
 dict(slug="salvador", name="Salvador", country="Brasil", emoji="🥁", g1="#3a2418", g2="#b3702f", intro="A capital da alegria: Pelourinho colorido, axé, praias e a melhor comida baiana do país.", days=[
   ("Pelourinho","Centro Histórico e Igreja do Bonfim","Elevador Lacerda e Mercado Modelo","Show de axé no Pelourinho"),
   ("Praias","Praia do Porto da Barra e Farol","Praia de Itapuã","Moqueca à beira-mar"),
   ("Cultura","Aula de capoeira e Dique do Tororó","Casa do Carnaval","Acarajé da Cira no Rio Vermelho")]),
 dict(slug="porto-de-galinhas", name="Porto de Galinhas", country="Brasil", emoji="🐠", g1="#0f4a4a", g2="#26b0a0", intro="Piscinas naturais de água cristalina, jangadas e um dos melhores destinos de praia do Nordeste.", days=[
   ("Piscinas naturais","Passeio de jangada às piscinas naturais","Vila e artesanato","Jantar frente ao mar"),
   ("Praias","Praia de Maracaípe e surfe","Pontal de Maracaípe (cavalos-marinhos)","Forró pé de serra"),
   ("Passeios","Muro Alto e recifes","Praia dos Carneiros (bate-volta)","Frutos do mar em Tamandaré")]),
 dict(slug="florianopolis", name="Florianópolis", country="Brasil", emoji="🏄", g1="#1a2f45", g2="#3f79a8", intro="A Ilha da Magia: 42 praias para todos os gostos, lagoa, dunas e a melhor ostra do país.", days=[
   ("Norte da ilha","Praia de Jurerê e Canasvieiras","Santo Antônio de Lisboa (ostras)","Pôr do sol na Ponte Hercílio Luz"),
   ("Leste e lagoa","Praia da Joaquina e dunas","Lagoa da Conceição","Balada na Lagoa"),
   ("Sul selvagem","Praia do Campeche","Ribeirão da Ilha (ostras)","Frutos do mar no Ribeirão")]),
]

PAGE = u"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Roteiro de 3 dias em {name}: o que fazer | Zenvoy</title>
<meta name="description" content="Roteiro pronto de 3 dias em {name} ({country}): o que fazer de manhã, tarde e noite. Monte sua viagem completa com voos, hotéis e itinerário no Zenvoy.">
<link rel="canonical" href="{base}/roteiro/{slug}/">
<meta name="robots" content="index,follow">
<meta property="og:type" content="article">
<meta property="og:title" content="Roteiro de 3 dias em {name} | Zenvoy">
<meta property="og:description" content="O que fazer em {name} em 3 dias — roteiro pronto e grátis. Planeje a viagem completa no Zenvoy.">
<meta property="og:url" content="{base}/roteiro/{slug}/">
<meta property="og:site_name" content="Zenvoy">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%E2%9C%88%EF%B8%8F%3C/text%3E%3C/svg%3E">
<script type="application/ld+json">
{{"@context":"https://schema.org","@type":"TouristTrip","name":"Roteiro de 3 dias em {name}","description":"Roteiro de 3 dias em {name}, {country}.","touristType":"Leisure","provider":{{"@type":"Organization","name":"Zenvoy","url":"{base}/"}}}}
</script>
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:'Inter',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0f1629;color:#e8ecf4;line-height:1.6}}
a{{color:inherit}}
.hero{{position:relative;min-height:52vh;display:flex;flex-direction:column;justify-content:flex-end;padding:70px 22px 28px;background:linear-gradient(135deg,{g1},{g2});background-size:cover;background-position:center;overflow:hidden}}
.hero::after{{content:'';position:absolute;inset:0;background:linear-gradient(to top,rgba(15,22,41,.92),rgba(15,22,41,.15))}}
.hero-in{{position:relative;z-index:2;max-width:900px;margin:0 auto;width:100%}}
.brand{{position:absolute;top:20px;left:22px;z-index:3;font-family:Georgia,serif;font-size:22px;font-weight:700;letter-spacing:.02em;text-decoration:none}}
.brand em{{color:#c9a96e;font-style:normal}}
.kick{{font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#c9a96e}}
h1{{font-family:Georgia,'Cormorant Garamond',serif;font-size:40px;line-height:1.05;margin:6px 0 8px}}
.sub{{font-size:16px;color:#c3cad8;max-width:640px}}
.wrap{{max-width:900px;margin:0 auto;padding:30px 22px 60px}}
.intro{{font-size:17px;color:#cdd4e2;margin-bottom:28px}}
.cta{{display:inline-flex;align-items:center;gap:8px;background:#c9a96e;color:#12172a;font-weight:800;font-size:16px;padding:15px 26px;border-radius:30px;text-decoration:none;margin:6px 0 30px;transition:transform .15s}}
.cta:hover{{transform:translateX(3px)}}
.day{{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:16px;padding:22px;margin-bottom:16px}}
.day h2{{font-family:Georgia,serif;font-size:24px;color:#fff;margin-bottom:2px}}
.day .dt{{font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#c9a96e;margin-bottom:14px}}
.slot{{display:flex;gap:12px;padding:10px 0;border-top:1px solid rgba(255,255,255,.07)}}
.slot:first-of-type{{border-top:none}}
.slot .ic{{font-size:20px;flex-shrink:0;width:26px;text-align:center}}
.slot .lb{{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8a93a6;width:58px;flex-shrink:0;padding-top:2px}}
.slot .tx{{font-size:15px;color:#e2e7f0}}
.others{{margin-top:40px}}
.others h3{{font-family:Georgia,serif;font-size:22px;margin-bottom:14px}}
.chips{{display:flex;flex-wrap:wrap;gap:10px}}
.chips a{{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:8px 15px;font-size:14px;font-weight:600;text-decoration:none;color:#e8ecf4}}
.chips a:hover{{border-color:#c9a96e;color:#c9a96e}}
.foot{{border-top:1px solid rgba(255,255,255,.09);margin-top:44px;padding-top:22px;font-size:13px;color:#8a93a6;text-align:center}}
.foot a{{color:#c9a96e;text-decoration:none}}
@media(max-width:560px){{h1{{font-size:32px}}.hero{{min-height:44vh}}}}
</style>
</head>
<body>
<a class="brand" href="/">Zen<em>voy</em></a>
<header class="hero" id="hero" data-dest="{name}">
  <div class="hero-in">
    <div class="kick">Roteiro de 3 dias {emoji}</div>
    <h1>O que fazer em {name}</h1>
    <p class="sub">{country} — um roteiro pronto para aproveitar {name} em três dias, de manhã à noite.</p>
  </div>
</header>
<main class="wrap">
  <p class="intro">{intro}</p>
  <a class="cta" href="/?dest={q}">Planejar minha viagem para {name} →</a>
  {days}
  <div class="others">
    <h3>Outros roteiros populares</h3>
    <div class="chips">{others}</div>
  </div>
  <div class="foot">
    <p>Roteiro sugerido pelo <a href="/?dest={q}">Zenvoy</a> — planejador de viagens com IA. Voos, hotéis, carros, roteiro dia a dia e dicas locais em segundos.</p>
    <p style="margin-top:8px"><a href="/roteiro/">← Ver todos os roteiros</a></p>
  </div>
</main>
<script>
(function(){{
  var h=document.getElementById('hero'); if(!h) return;
  var q=h.getAttribute('data-dest');
  fetch('/.netlify/functions/unsplash-car-image',{{method:'POST',headers:{{'Content-Type':'application/json'}},body:JSON.stringify({{query:q+' city travel landmark'}})}})
    .then(function(r){{return r.json();}}).then(function(d){{
      if(d&&d.imageUrl){{var img=new Image();img.onload=function(){{h.style.backgroundImage="url('"+d.imageUrl+"')";}};img.src=d.imageUrl;}}
    }}).catch(function(){{}});
}})();
</script>
</body>
</html>
"""

SLOT_ICONS = [("Manhã","🌅"),("Tarde","☀️"),("Noite","🌙")]

def build():
    for idx, d in enumerate(DESTS):
        days_html = ""
        for i, day in enumerate(d["days"], 1):
            title, manha, tarde, noite = day
            slots = ""
            for (lb, ic), tx in zip(SLOT_ICONS, [manha, tarde, noite]):
                slots += u'<div class="slot"><span class="ic">%s</span><span class="lb">%s</span><span class="tx">%s</span></div>' % (ic, lb, html.escape(tx))
            days_html += u'<article class="day"><div class="dt">Dia %d</div><h2>%s</h2>%s</article>' % (i, html.escape(title), slots)
        others = ""
        for j in range(1, 7):
            o = DESTS[(idx + j) % len(DESTS)]
            others += u'<a href="/roteiro/%s/">%s %s</a>' % (o["slug"], o["emoji"], html.escape(o["name"]))
        page = PAGE.format(
            name=html.escape(d["name"]), country=html.escape(d["country"]), emoji=d["emoji"],
            slug=d["slug"], q=d["name"].replace(" ", "%20"), base=BASE_URL,
            g1=d["g1"], g2=d["g2"], intro=html.escape(d["intro"]),
            days=days_html, others=others)
        outdir = os.path.join(ROOT, "roteiro", d["slug"])
        os.makedirs(outdir, exist_ok=True)
        io.open(os.path.join(outdir, "index.html"), "w", encoding="utf-8").write(page)
    cards = ""
    for d in DESTS:
        cards += u'<a href="/roteiro/%s/" style="display:block;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:18px;text-decoration:none;color:#e8ecf4"><div style="font-size:26px">%s</div><div style="font-family:Georgia,serif;font-size:20px;margin-top:4px">%s</div><div style="font-size:13px;color:#8a93a6">%s &middot; Roteiro de 3 dias</div></a>' % (d["slug"], d["emoji"], html.escape(d["name"]), html.escape(d["country"]))
    index = u"""<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Roteiros de viagem prontos (3 dias) | Zenvoy</title>
<meta name="description" content="Roteiros de 3 dias prontos para os destinos mais buscados: Paris, Bali, Cancun, Lisboa, Rio e mais. Planeje a viagem completa com IA no Zenvoy.">
<link rel="canonical" href="{base}/roteiro/">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%E2%9C%88%EF%B8%8F%3C/text%3E%3C/svg%3E">
<style>*{{box-sizing:border-box;margin:0;padding:0}}body{{font-family:'Inter',system-ui,sans-serif;background:#0f1629;color:#e8ecf4;line-height:1.6}}.wrap{{max-width:900px;margin:0 auto;padding:40px 22px 60px}}h1{{font-family:Georgia,serif;font-size:36px;margin-bottom:6px}}.sub{{color:#c3cad8;margin-bottom:28px}}.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}}a.brand{{font-family:Georgia,serif;font-size:22px;font-weight:700;text-decoration:none;color:#e8ecf4}}a.brand em{{color:#c9a96e;font-style:normal}}</style>
</head><body><div class="wrap"><a class="brand" href="/">Zen<em>voy</em></a>
<h1 style="margin-top:22px">Roteiros de viagem prontos</h1><p class="sub">Escolha um destino e veja um roteiro de 3 dias — depois monte a viagem completa com voos, hotéis e itinerário no Zenvoy.</p>
<div class="grid">{cards}</div></div></body></html>""".format(base=BASE_URL, cards=cards)
    io.open(os.path.join(ROOT, "roteiro", "index.html"), "w", encoding="utf-8").write(index)

    urls = [BASE_URL + "/", BASE_URL + "/roteiro/"] + [BASE_URL + "/roteiro/%s/" % d["slug"] for d in DESTS]
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    for u in urls:
        sm += '  <url><loc>%s</loc><changefreq>monthly</changefreq></url>\n' % u
    sm += '</urlset>\n'
    io.open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8").write(sm)
    io.open(os.path.join(ROOT, "robots.txt"), "w", encoding="utf-8").write(
        "User-agent: *\nAllow: /\nSitemap: %s/sitemap.xml\n" % BASE_URL)
    print("Generated %d roteiro pages + index + sitemap.xml + robots.txt" % len(DESTS))

if __name__ == "__main__":
    build()
