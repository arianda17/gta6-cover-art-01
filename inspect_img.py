import struct, sys
b = open(sys.argv[1], 'rb').read()
print('len', len(b), 'first8', b[:8])
if b[:8] == b'\x89PNG\r\n\x1a\n':
    w, h = struct.unpack('>II', b[16:24])
    print('PNG', w, h)
elif b[:2] == b'\xff\xd8':
    print('JPEG')
else:
    print('unknown')