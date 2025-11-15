import bcrypt
import getpass

def gerar_hash_bcrypt():
    print("=== Gerador de Hash Bcrypt ===")
    senha = getpass.getpass("Digite a senha: ").encode('utf-8')  

    # Gera o salt e o hash
    salt = bcrypt.gensalt(rounds=12) 
    senha_hash = bcrypt.hashpw(senha, salt)

    print("\nHash gerado (salve este valor no banco):")
    print(senha_hash.decode())

if __name__ == "__main__":
    gerar_hash_bcrypt()
