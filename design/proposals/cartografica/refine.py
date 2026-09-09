from pathlib import Path
p=Path('design/proposals/cartografica')
water='M292 276 363 209 628 468Q645 484 668 483L746 477 749 497 807 492 805 473 839 470 849 544 737 553 673 1040H610L673 558 637 561-20 785-42 724 574 514 559 500Z'
blocks='''<path d="M40 40H239L294 95 192 197 40 51Z"/>
<path d="M327 62H509L642 195 532 305Z"/>
<path d="M554 62H796V172H665Z"/>
<path d="M822 62H984V306H822Z"/>
<path d="M677 200H796V305H677Z"/>
<path d="M571 337 665 329 797 333V425L669 438Z"/>
<path d="M823 333H984V422H823Z"/>
<path d="M70 208 201 204 264 270 171 363 65 257Z"/>
<path d="M52 286 155 389 57 487 40 470Z"/>
<path d="M289 335 450 495 357 558 196 430Z"/>
<path d="M40 546 172 454 325 583 40 681Z"/>
<path d="M772 590 890 580V695L758 737Z"/>
<path d="M918 573H984V825H918Z"/>
<path d="M745 770 891 723V988H716Z"/>
<path d="M375 708 617 625 601 746 468 821Z"/>
<path d="M311 730 439 846 208 988H50Z"/>
<path d="M475 859 594 789 569 988H284Z"/>'''
icon=f'''<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><title>Darsena — Atlante</title><desc>A flat schematic map of Milan’s elongated Darsena basin, ending at the south-eastern junction with the Grande and Pavese canals.</desc><defs><clipPath id="tile"><rect x="62" y="62" width="900" height="900" rx="204"/></clipPath></defs><g clip-path="url(#tile)"><rect x="62" y="62" width="900" height="900" fill="#F4F5F2"/><g fill="#E5E7E2">{blocks}</g><path d="{water}" fill="#2D46C8"/></g></svg>'''
p.joinpath('icon.svg').write_text(icon)
# The mark is the identical water outline, fit to a 24 px square. It keeps the same north-up map orientation.
p.joinpath('mark.svg').write_text(f'''<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><title>Darsena — Atlante</title><path transform="translate(2 0) scale(.023)" fill="currentColor" d="M292 276 363 209 628 468Q645 484 668 483L839 470 849 544 737 553 692 900H628L673 558 637 561 0 778-20 715 574 514 559 500Z"/></svg>''')
# Wide hero: same north-up plan, reduced and centered, with open canals crossing the lower edge.
# No fake geographic precision: buildings are restrained schematic blocks, while the topology follows the supplied aerial reference.
for dark in [False,True]:
 bg='#20232A' if dark else '#F4F5F2'
 block='#292D35' if dark else '#E5E7E2'
 blue='#728BFA' if dark else '#2D46C8'
 ink='#B9C0D0' if dark else '#737A88'
 name='harbor-dark.svg' if dark else 'harbor.svg'
 svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="640" viewBox="0 0 1200 640"><title>Darsena — Atlante urbano</title><desc>Original flat schematic artwork. The basin extends to the north-west. The Grande heads south-west from the south-eastern junction; the Pavese heads south. Building footprints are composed, not a survey.</desc><defs><clipPath id="frame"><rect width="1200" height="640" rx="8"/></clipPath></defs><g clip-path="url(#frame)"><rect width="1200" height="640" fill="{bg}"/><g transform="translate(248 -93) scale(.86)"><g fill="{block}">{blocks}</g><path d="{water}" fill="{blue}"/><path d="m459 566 19 55M656 708l65 9" stroke="{bg}" stroke-width="5" fill="none"/></g><g fill="{ink}" font-family="Helvetica Neue,Arial,sans-serif" font-size="13" font-weight="500" letter-spacing="2"><text x="556" y="221" transform="rotate(44 556 221)">DARSENA</text><text x="447" y="521" transform="rotate(-19 447 521)">GRANDE</text><text x="892" y="567" transform="rotate(-82 892 567)">PAVESE</text></g></g></svg>'''
 p.joinpath(name).write_text(svg)
